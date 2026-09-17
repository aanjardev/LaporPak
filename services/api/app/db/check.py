from sqlalchemy import text

from app.db.session import get_engine


def main():
    with get_engine().connect() as connection:
        result = connection.execute(
            text(
                """
                select
                    current_database() as database_name,
                    current_user as database_user
                """
            )
        ).one()

        print("Database connection OK")
        print(f"Database: {result.database_name}")
        print(f"User: {result.database_user}")


if __name__ == "__main__":
    main()
