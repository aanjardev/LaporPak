import argparse
import asyncio

from app.services.referrals import process_next_referral_job, referral_worker_loop


def main() -> None:
    parser = argparse.ArgumentParser(description="Process persistent referral jobs")
    parser.add_argument("--once", action="store_true", help="Process at most one job")
    args = parser.parse_args()
    if args.once:
        print(process_next_referral_job().model_dump_json())
        return
    asyncio.run(referral_worker_loop())


if __name__ == "__main__":
    main()
