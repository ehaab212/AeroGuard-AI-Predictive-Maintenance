
from pathlib import Path
import pandas as pd

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data" / "raw"

# NASA C-MAPSS column names
COLUMNS = (
    ["engine_id", "cycle"]
    + [f"setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)


def load_data():
    """Load NASA C-MAPSS FD001 dataset."""

    train_path = DATA_DIR / "train_FD001.txt"
    test_path = DATA_DIR / "test_FD001.txt"
    rul_path = DATA_DIR / "RUL_FD001.txt"

    for path in [train_path, test_path, rul_path]:
        if not path.is_file():
            raise FileNotFoundError(
                f"Dataset file not found: {path}"
            )

    train_df = pd.read_csv(
        train_path,
        sep=r"\s+",
        header=None,
        names=COLUMNS
    )

    test_df = pd.read_csv(
        test_path,
        sep=r"\s+",
        header=None,
        names=COLUMNS
    )

    rul_df = pd.read_csv(
        rul_path,
        sep=r"\s+",
        header=None,
        names=["rul"]
    )

    return train_df, test_df, rul_df


def validate_data(train_df, test_df, rul_df):
    """Perform basic dataset quality checks."""

    print("\n===== DATASET VALIDATION =====")

    for name, df in [
        ("Train", train_df),
        ("Test", test_df)
    ]:
        print(f"\n{name} Dataset")
        print(f"Shape: {df.shape}")
        print(f"Unique engines: {df['engine_id'].nunique()}")
        print(f"Missing values: {df.isna().sum().sum()}")

        duplicates = df.duplicated(
            subset=["engine_id", "cycle"]
        ).sum()

        print(f"Duplicate engine-cycle records: {duplicates}")

        if df.shape[1] != 26:
            raise ValueError(
                f"{name} data must contain 26 columns."
            )

        if df.isna().any().any():
            raise ValueError(
                f"{name} contains missing values."
            )

        if duplicates > 0:
            raise ValueError(
                f"{name} contains duplicate engine cycles."
            )

        if (df["cycle"] < 1).any():
            raise ValueError(
                f"{name} contains invalid cycles."
            )

    print("\nRUL Dataset")
    print(f"Shape: {rul_df.shape}")
    print(f"Missing values: {rul_df.isna().sum().sum()}")

    if len(rul_df) != test_df["engine_id"].nunique():
        raise ValueError(
            "RUL labels must match the number of test engines."
        )

    if rul_df.isna().any().any():
        raise ValueError("RUL labels contain missing values.")

    print("\nBasic validation completed successfully!")


if __name__ == "__main__":

    train_df, test_df, rul_df = load_data()

    validate_data(train_df, test_df, rul_df)

    print("\n===== TRAINING DATA PREVIEW =====")
    print(train_df.head())

    print("\n===== ENGINE LIFECYCLE SUMMARY =====")
    print(
        train_df.groupby("engine_id")["cycle"]
        .max()
        .describe()
    )
