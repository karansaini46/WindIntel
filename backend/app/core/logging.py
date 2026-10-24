import logging
import sys
from typing import Optional


def setup_logging(debug: bool = False, log_level: Optional[str] = None) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO
    if log_level:
        level = getattr(logging, log_level.upper(), level)
        
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True
    )
    
    # Silence overly verbose external loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    logger = logging.getLogger("windintel")
    logger.setLevel(level)
    return logger


logger = logging.getLogger("windintel")
