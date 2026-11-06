from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '700b6994d0c1'
down_revision: Union[str, None] = '7e3251666e40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    pass


def downgrade() -> None:

    pass
