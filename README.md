# Pool Town ERP

Pool Town ERP is a billiard hall management and accounting application built for Pool Town. It brings together daily hall operations and double-entry bookkeeping into a single, straightforward system for managing table rentals, gaming sessions, retail inventory, operational expenses, and business finances.

---

## Main Features

- **Pool Table Management and Billing**: Start and stop session timers, calculate table charges automatically using fixed rate tiers, and collect payments in cash or via bank transfer.
- **PS4 Session Management**: Hourly billing for single-player and two-player gaming, player tracking, and payment collection.
- **Player Management**: Maintain player profiles, track visit history, and manage outstanding session balances.
- **Drink Sales and Inventory**: Track soft drink bottle inventory, record counter sales, calculate cost of goods sold (COGS) and gross profit, and log stock adjustments.
- **Expense Management**: Record utility and operational bills, split payments between cash and bank accounts, and track vendor payables.
- **Cash, Bank and Savings Management**: Real-time balance tracking for Cash in Hand and the Main Bank Account, with internal cash transfers and an automated 40% net profit allocation to emergency savings reserves.
- **Partner and Loan Management**: Monthly profit distribution for the three equal partners (Akash, Pasan, and Vishwa), tracking partner drawings, opening capital contributions, and loan repayments.
- **Accounting, Transaction History and Reports**: Automated double-entry general ledger enforcing balanced debit and credit entries, complete audit trails, and daily, weekly, and monthly business summaries.
- **Excel Exports**: Formatted `.xlsx` spreadsheet downloads for revenue summaries, transaction ledgers, inventory counts, and session records.

---

## Windows Desktop Application

Pool Town ERP is packaged as a standalone Windows desktop application for everyday business use. The goal is to provide a simple, reliable experience for non-technical users such as accountants and front-desk staff.

- **No Developer Tools**: Users do not need to install Python, Node.js, npm, Git, or open a terminal.
- **Standalone Window**: The application launches in its own dedicated window with native desktop shortcuts and a clean user interface.
- **Protected Business Data**: The database is stored in the user profile directory (`%LOCALAPPDATA%\PoolTownERP\data\billiard.db`), separate from the installation files. Reinstalling or updating the application will never overwrite or erase your company data.

---

## Installation

The installer has been built and is available in the repository inside the `Pool Town ERP Setup` directory as `PoolTownERP-Setup.exe` (34.4 MB), as well as through project releases.

To install Pool Town ERP on Windows 10 or Windows 11 (64-bit):

1. Obtain `PoolTownERP-Setup.exe` from the `Pool Town ERP Setup` folder or from the project's GitHub Release.
2. Double-click `PoolTownERP-Setup.exe` to start the installation wizard.
3. Follow the on-screen instructions (accept the default installation directory and ensure "Create a desktop shortcut" is selected).
4. Click "Finish" when setup completes. Pool Town ERP will launch automatically.
5. In the future, open the application anytime by double-clicking the **Pool Town ERP** shortcut on your desktop or Start Menu.
6. Log in using your assigned administrator or staff credentials.

For more detailed step-by-step guidance, refer to `INSTALLATION_GUIDE.txt` or `Pool Town ERP Setup/INSTALLATION_GUIDE.txt`.

---

## Developer Setup

### Technologies

- **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, Pydantic v2
- **Database**: SQLite with Write-Ahead Logging (`WAL`) and foreign key constraints enabled
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query

### Development Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/VishwaSashintha/Pool-Town.git
   cd Pool-Town
   ```

2. **Set up the backend:**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   ```

3. **Set up the frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run the application:**
   From the project root on Windows, double-click `start.bat` to launch both backend (`http://127.0.0.1:8000`) and frontend (`http://localhost:5173`) automatically.

   Alternatively, run the services in separate terminals:
   - Backend: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --port 8000 --reload`
   - Frontend: `cd frontend && npm run dev`

5. **Run backend tests:**
   ```bash
   cd backend
   python -m pytest tests/
   ```

6. **Build the desktop installer:**
   ```bat
   cd installer
   build.bat
   ```

---

## Data and Privacy

- **Keep Business Records Private**: Real financial data, player details, partner distributions, and transaction records must remain strictly on the local machine and must never be committed to a public GitHub repository.
- **Git Exclusions**: Database files (`*.db`), write-ahead log files (`*-wal`, `*-shm`), private backups, and `.env` configuration files are excluded by `.gitignore`.
- **Regular Backups**: Use the built-in "Backup & Restore" feature regularly to generate timestamped database snapshots. Backups are saved to `%LOCALAPPDATA%\PoolTownERP\backups\` and should be copied periodically to an external drive or secure storage.

---

## Support

If you encounter installation issues, startup errors, or unexpected behavior, contact the project administrator:

- **Maintainer**: Vishwa Sashintha
- **GitHub Repository**: https://github.com/VishwaSashintha/Pool-Town
- **Issue Tracker**: https://github.com/VishwaSashintha/Pool-Town/issues

---

## License

No license has been specified. This is private software for the Pool Town billiard hall.
