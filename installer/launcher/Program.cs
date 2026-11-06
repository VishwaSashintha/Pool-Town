using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace PoolTownERP
{
    static class Program
    {
        private static Process _backendProcess;
        private static Mutex _mutex;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool createdNew;
            _mutex = new Mutex(true, "PoolTownERP_Application_Mutex", out createdNew);
            if (!createdNew)
            {
                MessageBox.Show("Pool Town ERP is already running.", "Pool Town ERP", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            AppDomain.CurrentDomain.ProcessExit += OnProcessExit;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string backendExe = Path.Combine(baseDir, "backend", "PoolTownBackend.exe");
            if (!File.Exists(backendExe))
            {
                backendExe = Path.Combine(baseDir, "PoolTownBackend.exe");
            }

            if (!File.Exists(backendExe))
            {
                MessageBox.Show("Backend executable not found at: " + backendExe, "Pool Town ERP Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appDataDir = Path.Combine(localAppData, "PoolTownERP");
            string dataDir = Path.Combine(appDataDir, "data");
            string backupDir = Path.Combine(appDataDir, "backups");
            string browserDir = Path.Combine(appDataDir, "browser");

            Directory.CreateDirectory(dataDir);
            Directory.CreateDirectory(backupDir);
            Directory.CreateDirectory(browserDir);

            int port = GetAvailablePort(8000, 8050);

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = backendExe;
            psi.WorkingDirectory = Path.GetDirectoryName(backendExe);
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.EnvironmentVariables["POOL_TOWN_PORT"] = port.ToString();
            psi.EnvironmentVariables["POOL_TOWN_HOST"] = "127.0.0.1";
            psi.EnvironmentVariables["POOL_TOWN_DATA_DIR"] = dataDir;
            psi.EnvironmentVariables["POOL_TOWN_BACKUP_DIR"] = backupDir;

            try
            {
                _backendProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch backend: " + ex.Message, "Pool Town ERP Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string healthUrl = "http://127.0.0.1:" + port + "/health";
            bool isReady = WaitForServer(healthUrl, 25);
            if (!isReady)
            {
                string logFile = Path.Combine(dataDir, "server.log");
                string logContent = File.Exists(logFile) ? "\n\nServer log:\n" + File.ReadAllText(logFile) : "";
                KillBackend();
                MessageBox.Show("Pool Town ERP server failed to start in time." + logContent, "Startup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            string edgePath = FindEdgePath();
            string appUrl = "http://127.0.0.1:" + port + "/";

            if (!string.IsNullOrEmpty(edgePath) && File.Exists(edgePath))
            {
                ProcessStartInfo edgePsi = new ProcessStartInfo();
                edgePsi.FileName = edgePath;
                edgePsi.Arguments = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --window-size=1366,820 --no-first-run --no-default-browser-check", appUrl, browserDir);
                edgePsi.UseShellExecute = false;

                try
                {
                    using (Process edgeProcess = Process.Start(edgePsi))
                    {
                        edgeProcess.WaitForExit();
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to open desktop window: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                Process.Start(appUrl);
                MessageBox.Show("Pool Town ERP is running in your default browser at " + appUrl + ".\n\nClick OK when you are done to close the server.", "Pool Town ERP", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }

            KillBackend();
        }

        private static int GetAvailablePort(int startingPort, int maxPort)
        {
            for (int port = startingPort; port <= maxPort; port++)
            {
                try
                {
                    TcpListener listener = new TcpListener(IPAddress.Loopback, port);
                    listener.Start();
                    listener.Stop();
                    return port;
                }
                catch
                {
                    // next
                }
            }
            return startingPort;
        }

        private static bool WaitForServer(string url, int timeoutSeconds)
        {
            DateTime start = DateTime.Now;
            while ((DateTime.Now - start).TotalSeconds < timeoutSeconds)
            {
                if (_backendProcess != null && _backendProcess.HasExited)
                {
                    return false;
                }

                try
                {
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Timeout = 1000;
                    using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                    {
                        if (response.StatusCode == HttpStatusCode.OK)
                        {
                            return true;
                        }
                    }
                }
                catch
                {
                    // retry
                }

                Thread.Sleep(300);
            }
            return false;
        }

        private static string FindEdgePath()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe")
            };

            foreach (string path in candidates)
            {
                if (File.Exists(path))
                {
                    return path;
                }
            }

            return null;
        }

        private static void OnProcessExit(object sender, EventArgs e)
        {
            KillBackend();
        }

        private static void KillBackend()
        {
            try
            {
                if (_backendProcess != null && !_backendProcess.HasExited)
                {
                    _backendProcess.Kill();
                    _backendProcess.WaitForExit(3000);
                }
            }
            catch
            {
                // ignore
            }
        }
    }
}

