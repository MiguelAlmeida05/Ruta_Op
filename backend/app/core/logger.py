
import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict

class JsonFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the LogRecord.
    Supports extra fields passed via the 'extra' argument or ContextVars.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineNo": record.lineno,
        }
        
        # Add extra fields that are not standard LogRecord attributes
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
            
        if hasattr(record, "path"):
             log_record["path"] = record.path
             
        if hasattr(record, "method"):
             log_record["method"] = record.method
             
        if hasattr(record, "duration_ms"):
             log_record["duration_ms"] = record.duration_ms

        # Include any other extra fields
        for key, value in record.__dict__.items():
            if key not in ["args", "asctime", "created", "exc_info", "exc_text", "filename", 
                           "funcName", "levelname", "levelno", "lineno", "module", 
                           "msecs", "message", "msg", "name", "pathname", "process", 
                           "processName", "relativeCreated", "stack_info", "thread", "threadName",
                           "request_id", "path", "method", "duration_ms"]: # Skip already handled or standard
                if not key.startswith("_"):
                    log_record[key] = value

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_record)

def get_logger(name: str):
    logger = logging.getLogger(name)
    
    # If logger already has handlers, assume it's configured
    if logger.hasHandlers():
        return logger
        
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    
    logger.addHandler(handler)
    logger.propagate = False
    
    return logger
