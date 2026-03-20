"""
Vietnamese Spell Corrector - Sửa lỗi dấu tiếng Việt từ OCR.
"""

import re
from typing import Dict

FOREIGN_CHAR_MAP: Dict[str, str] = {
    "받": "nhi",
    "혀": "hiể",
    "넓": "nhiề",
    "з": "ì",
    "м": "m",
    "и": "i",
    "н": "n",
    "р": "r",
    "с": "c",
    "о": "o",
    "е": "e",
    "а": "a",
    "у": "y",
    "—": "-",
    "–": "-",
    "\u200b": "",
    "\ufeff": "",
}

DIACRITICS_CORRECTIONS: Dict[str, str] = {
    "hồng hóc": "hỏng hóc",
    "hồng hoc": "hỏng hóc",
    "hông hóc": "hỏng hóc",
    "dân đến": "dẫn đến",
    "dân đên": "dẫn đến",
    "dẫn đên": "dẫn đến",
    "nói dầu": "nói đầu",
    "lòi nói": "lời nói",
    "giói thiêu": "giới thiệu",
    "giói thiệu": "giới thiệu",
    "giới thiêu": "giới thiệu",
    "phàn mêm": "phần mềm",
    "phản mêm": "phần mềm",
    "phàn mềm": "phần mềm",
    "phản mềm": "phần mềm",
    "tзм hiêu": "tìm hiểu",
    "tìm hiêu": "tìm hiểu",
    "tim hiểu": "tìm hiểu",
    "nghìêm trọng": "nghiêm trọng",
    "nghệm trọng": "nghiêm trọng",
    "tôi ưu": "tối ưu",
    "tôi đa": "tối đa",
    "tôi ưu hóa": "tối ưu hóa",
    "thập": "thấp",
    "theo đổi": "theo dõi",
    "đổi ngữ": "đội ngũ",
    "đổi với": "đối với",
    "đổi hướng": "đối hướng",
    "trình bayer": "trình bày",
    "trình bàyer": "trình bày",
    "giám chi phí": "giảm chi phí",
    "giám bót": "giảm bớt",
    "giám rủi ro": "giảm rủi ro",
    "giám thiếu": "giảm thiểu",
    "giám thiêu": "giảm thiểu",
    "giám mức": "giảm mức",
    "giám chị": "giảm chỉ",
    "giám tần": "giảm tần",
    "tiết kiểm": "tiết kiệm",
    "tinh gơn": "tinh gọn",
    "người lực": "nguồn lực",
    "phòng vấn": "phỏng vấn",
    "phống vấn": "phỏng vấn",
    "làm thẻ nào": "làm thế nào",
    "như thể nào": "như thế nào",
    "nền tàng": "nền tảng",
    "vât tư": "vật tư",
    "vẻu tổ": "yếu tố",
    "độ tin cây": "độ tin cậy",
    "cho thây": "cho thấy",
    "được mô tà": "được mô tả",
    "chị ra": "chỉ ra",
    "chị số": "chỉ số",
    "chị định": "chỉ định",
    "chỉ ra ràng": "chỉ ra rằng",
    "kỳ vọng ràng": "kỳ vọng rằng",
    "điều hưống": "điều hướng",
    "ánh hương": "ảnh hưởng",
    "miền phí": "miễn phí",
    "miền bắc": "miền Bắc",
    "miền nam": "miền Nam",
    "xe đâu kéo": "xe đầu kéo",
    "bàng cách": "bằng cách",
    "nhìêm vụ": "nhiệm vụ",
    "nhiệm doanh": "nhiều doanh",
    "dựa đưa trên": "dựa trên",
    "đưa trên": "dựa trên",
    "tăng 07": "tầng 07",
}

REGEX_CORRECTIONS = [
    (re.compile(r"rủi\s+ro\s+thập", re.IGNORECASE), "rủi ro thấp"),
    (re.compile(r"(có\s+thể|để)\s+hiều"), r"\1 hiểu"),
    (re.compile(r"cận\s+bằng"), "cân bằng"),
    (re.compile(r"có\s+thể\s+chơn"), "có thể chọn"),
    (re.compile(r"[Nn]ghiêm\b(?!\s+trọng)"), lambda m: m.group(0).replace("iêm", "iệm")),
]


def correct_vietnamese_diacritics(text: str) -> str:
    if not text:
        return text

    corrected = text

    for foreign, viet in FOREIGN_CHAR_MAP.items():
        corrected = corrected.replace(foreign, viet)

    for wrong, right in DIACRITICS_CORRECTIONS.items():
        pattern = re.compile(re.escape(wrong), re.IGNORECASE)
        matches = pattern.findall(corrected)
        if not matches:
            continue
        for match in matches:
            replacement = right
            if match and match[0].isupper() and right[0].islower():
                replacement = right[0].upper() + right[1:]
            corrected = corrected.replace(match, replacement, 1)

    for pattern, replacement in REGEX_CORRECTIONS:
        corrected = pattern.sub(replacement, corrected)

    return corrected
