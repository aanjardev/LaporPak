"""Decode and re-encode untrusted citizen images before private storage."""

import warnings
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def sanitize_image(data: bytes, mime_type: str) -> bytes:
    if len(data) > MAX_BYTES or mime_type not in FORMATS:
        raise ValueError("unsupported image or image exceeds 5 MiB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                width, height = image.size
                if (
                    image.format != FORMATS[mime_type]
                    or max(width, height) > 10000
                    or width * height > 25000000
                    or getattr(image, "n_frames", 1) != 1
                ):
                    raise ValueError("image format or dimensions are invalid")
                image.load()
                oriented = ImageOps.exif_transpose(image)
                # New pixel buffer drops EXIF, text, ICC and trailing payloads.
                mode = "RGB" if mime_type == "image/jpeg" else "RGBA"
                pixels = oriented.convert(mode)
                clean = Image.frombytes(mode, pixels.size, pixels.tobytes())
                output = BytesIO()
                clean.save(output, format=FORMATS[mime_type])
                result = output.getvalue()
                if len(result) > MAX_BYTES:
                    raise ValueError("encoded image exceeds 5 MiB")
                return result
    except (
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise ValueError("image cannot be decoded safely") from exc
