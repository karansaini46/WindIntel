import csv
import io
from app.schemas.evaluation import EvaluationResponse


def generate_evaluation_csv(evaluation: EvaluationResponse) -> str:
    """
    Generates an RFC 4180 compliant CSV string of evaluated delivery intervals
    including generation values, errors, timestamps, and lead times.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    
    # CSV Header with explicit units
    writer.writerow([
        "delivery_start_time_utc",
        "delivery_end_time_utc",
        "settlement_date",
        "settlement_period",
        "actual_generation_mw",
        "forecast_generation_mw",
        "forecast_error_mw",
        "abs_forecast_error_mw",
        "forecast_publish_time_utc",
        "lead_time_hours",
        "status"
    ])
    
    for row in evaluation.intervals:
        writer.writerow([
            row.start_time.isoformat(),
            row.end_time.isoformat(),
            row.settlement_date,
            row.settlement_period,
            f"{row.actual_mw:.2f}" if row.actual_mw is not None else "",
            f"{row.forecast_mw:.2f}" if row.forecast_mw is not None else "",
            f"{row.error_mw:.2f}" if row.error_mw is not None else "",
            f"{row.abs_error_mw:.2f}" if row.abs_error_mw is not None else "",
            row.publish_time.isoformat() if row.publish_time is not None else "",
            f"{row.lead_time_hours:.2f}" if row.lead_time_hours is not None else "",
            row.status.value
        ])
        
    return output.getvalue()
