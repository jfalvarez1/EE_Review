"""
Re-split PDF files that are over 1MB into smaller chunks.
Uses iterative page reduction to ensure each output file is under 1MB.
"""

import os
import re
from pathlib import Path
from PyPDF2 import PdfReader, PdfWriter

MAX_SIZE_BYTES = 1 * 1024 * 1024  # 1MB
SPLIT_DIR = Path(r"C:\Users\juanf\Desktop\Claude\EE_learning\split_pdfs")

def get_file_size(pdf_writer):
    """Get the size of a PdfWriter object by writing to bytes."""
    from io import BytesIO
    buffer = BytesIO()
    pdf_writer.write(buffer)
    return buffer.tell()

def split_pdf_to_size(input_path: Path, max_size: int = MAX_SIZE_BYTES):
    """
    Split a PDF into multiple parts where each part is under max_size bytes.
    Returns list of output file paths.
    """
    reader = PdfReader(str(input_path))
    total_pages = len(reader.pages)

    if total_pages == 0:
        print(f"  Skipping {input_path.name}: no pages")
        return []

    # Parse original filename to extract base name and page info
    # Pattern: BookName_partXX_pagesN-M.pdf
    match = re.match(r'(.+?)_part\d+_pages(\d+)-(\d+)\.pdf', input_path.name)
    if match:
        base_name = match.group(1)
        original_start_page = int(match.group(2))
    else:
        base_name = input_path.stem
        original_start_page = 1

    output_files = []
    current_page = 0
    part_num = 1

    while current_page < total_pages:
        writer = PdfWriter()
        pages_in_chunk = 0

        # Add pages one by one until we exceed the size limit
        while current_page + pages_in_chunk < total_pages:
            # Create a test writer with current pages + 1
            test_writer = PdfWriter()
            for i in range(pages_in_chunk + 1):
                test_writer.add_page(reader.pages[current_page + i])

            test_size = get_file_size(test_writer)

            if test_size > max_size and pages_in_chunk > 0:
                # Adding this page would exceed limit, stop here
                break

            pages_in_chunk += 1

            # If even a single page exceeds the limit, we still include it
            if test_size > max_size and pages_in_chunk == 1:
                print(f"  Warning: Single page exceeds {max_size/1024/1024:.1f}MB limit")
                break

        # Create the actual output file
        for i in range(pages_in_chunk):
            writer.add_page(reader.pages[current_page + i])

        # Calculate actual page numbers from original document
        actual_start = original_start_page + current_page
        actual_end = original_start_page + current_page + pages_in_chunk - 1

        # Generate output filename
        output_name = f"{base_name}_part{part_num:02d}_pages{actual_start}-{actual_end}.pdf"
        output_path = input_path.parent / output_name

        # Write the file
        with open(output_path, 'wb') as f:
            writer.write(f)

        actual_size = output_path.stat().st_size
        print(f"  Created: {output_name} ({pages_in_chunk} pages, {actual_size/1024/1024:.2f}MB)")

        output_files.append(output_path)
        current_page += pages_in_chunk
        part_num += 1

    return output_files

def process_directory():
    """Process all PDFs in split_pdfs directory."""
    # Find all PDFs over 1MB
    large_pdfs = []
    for pdf_path in SPLIT_DIR.rglob("*.pdf"):
        size = pdf_path.stat().st_size
        if size > MAX_SIZE_BYTES:
            large_pdfs.append((pdf_path, size))

    if not large_pdfs:
        print("No PDFs over 1MB found!")
        return

    print(f"Found {len(large_pdfs)} PDFs over 1MB:\n")

    for pdf_path, size in sorted(large_pdfs, key=lambda x: -x[1]):
        print(f"\nProcessing: {pdf_path.name} ({size/1024/1024:.2f}MB)")

        # Split the PDF
        output_files = split_pdf_to_size(pdf_path)

        if output_files:
            # Verify all outputs are under limit
            all_ok = all(f.stat().st_size <= MAX_SIZE_BYTES for f in output_files)

            if all_ok:
                # Remove original file
                print(f"  Removing original: {pdf_path.name}")
                pdf_path.unlink()
            else:
                print(f"  Warning: Some output files still exceed 1MB")
                # Recursively process those files
                for f in output_files:
                    if f.stat().st_size > MAX_SIZE_BYTES:
                        print(f"  Re-processing: {f.name}")
                        sub_outputs = split_pdf_to_size(f)
                        if sub_outputs:
                            f.unlink()

def verify_all_under_limit():
    """Verify all PDFs are now under 1MB."""
    print("\n" + "="*60)
    print("VERIFICATION")
    print("="*60)

    over_limit = []
    total_files = 0

    for pdf_path in SPLIT_DIR.rglob("*.pdf"):
        total_files += 1
        size = pdf_path.stat().st_size
        if size > MAX_SIZE_BYTES:
            over_limit.append((pdf_path, size))

    if over_limit:
        print(f"\n{len(over_limit)} files still over 1MB:")
        for path, size in over_limit:
            print(f"  - {path.name}: {size/1024/1024:.2f}MB")
    else:
        print(f"\nAll {total_files} PDF files are now under 1MB!")

if __name__ == "__main__":
    print("PDF Re-Splitter - Splitting files to <=1MB")
    print("="*60)

    process_directory()
    verify_all_under_limit()
