
import pandas as pd


def engineer_features(
    df: pd.DataFrame,
    sensor_columns: list[str],
    windows=(5, 10, 30)
) -> pd.DataFrame:
    """
    Create historical sensor features.

    Each engine is processed independently.
    Features use current and past cycles only.
    """

    result = df.sort_values(
        ["engine_id", "cycle"]
    ).copy()

    new_features = {}

    for sensor in sensor_columns:

        grouped = result.groupby(
            "engine_id",
            sort=False
        )[sensor]

        for window in windows:

            new_features[f"{sensor}_mean_{window}"] = (
                grouped.transform(
                    lambda s: s.rolling(
                        window=window,
                        min_periods=1
                    ).mean()
                )
            )

            new_features[f"{sensor}_std_{window}"] = (
                grouped.transform(
                    lambda s: s.rolling(
                        window=window,
                        min_periods=1
                    ).std(ddof=0)
                )
            )

        new_features[f"{sensor}_delta_5"] = (
            grouped.diff(5).fillna(0)
        )

    # Build new features in a separate DataFrame.
    feature_df = pd.DataFrame(
        new_features,
        index=result.index
    )

    # Combine columns in one operation.
    result = pd.concat(
        [result, feature_df],
        axis=1
    )

    return result
