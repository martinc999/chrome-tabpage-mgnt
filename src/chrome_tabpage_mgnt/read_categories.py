import pandas as pd
import os


def read_categorization_file(file_path: str) -> pd.DataFrame | None:
    """
    Reads a pipe-separated categorization file into a pandas DataFrame.

    The expected format for each line is:
    tab_id|window_id|domain|title|url_ext|category

    Args:
        file_path (str): The path to the input file.

    Returns:
        pd.DataFrame: A DataFrame containing the categorized tab data,
                      or None if an error occurs.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'")
        return None

    # Define the column names based on the specified file format
    column_names = ["tab_id", "window_id", "domain", "title", "url_ext", "category"]

    try:
        # Use pandas.read_csv to read the pipe-delimited file.
        # - sep='|': Specifies the pipe as the delimiter.
        # - header=None: Indicates the file has no header row.
        # - names=column_names: Assigns our defined names to the columns.
        # - on_bad_lines='warn': Warns about malformed lines instead of failing.
        df = pd.read_csv(file_path, sep="|", header=None, names=column_names, on_bad_lines="warn")
        print(f"Successfully read {len(df)} records from '{file_path}'")
        return df
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return None


def print_category_summary(df: pd.DataFrame, sample_size: int = 3):
    """
    Prints category summary in the format:
    Category: X tabs
        - title | domain
        - title | domain
        - title | domain

    Args:
        df (pd.DataFrame): The categorized tab data
        sample_size (int): Number of samples to display for each category
    """
    # Get value counts for categories
    category_counts = df["category"].value_counts()

    # Print summary for each category
    for category, count in category_counts.items():
        print(f"{category}: {count} tabs")

        # Get samples for this category
        category_data = df[df["category"] == category]
        samples = category_data[["title", "domain"]].sample(n=min(sample_size, len(category_data)), random_state=42)

        # Print each sample in the format "title | domain"
        for _, sample in samples.iterrows():
            title = sample["title"] if pd.notna(sample["title"]) else "No title"
            domain = sample["domain"] if pd.notna(sample["domain"]) else "No domain"
            print(f"    - {title} | {domain}")

        print()  # Add empty line between categories


def print_sorted_category_list(df: pd.DataFrame):
    """
    Prints a sorted list of categories with their counts.
    Sorted alphabetically by category name.

    Args:
        df (pd.DataFrame): The categorized tab data
    """
    print("=" * 60)
    print("SORTED CATEGORY LIST")
    print("=" * 60)

    # Get value counts and sort by category name (index)
    category_counts = df["category"].value_counts().sort_index()

    # Print each category with its count
    for category, count in category_counts.items():
        print(f"{category}: {count} tabs")

    # Print total
    print("-" * 60)
    print(f"TOTAL: {len(df)} tabs across {len(category_counts)} categories")
    print("=" * 60)


# --- Example Usage ---
if __name__ == "__main__":
    # Use the path to the file provided in the context.
    # Update this path if your file is located elsewhere.
    file_to_read = "/home/marcin/repos/chrome-tabpage-mgnt/categorization-mapping-1759438683424.txt"

    # Call the function to read the file into a DataFrame
    categorization_df = read_categorization_file(file_to_read)

    # If the DataFrame was loaded successfully, display its head and info
    if categorization_df is not None:
        print("\n--- First 5 rows of the DataFrame ---")
        print(categorization_df.head())

        print("\n--- DataFrame Info ---")
        categorization_df.info()

        print("\n--- Category Summary with Samples ---")
        print_category_summary(categorization_df, sample_size=10)

        print("\n")
        print_sorted_category_list(categorization_df)
