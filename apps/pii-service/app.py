from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

app = FastAPI(title="LLM Gateway PII Sidecar")

# Initialize Presidio Engines
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Explicitly define which entities to redact
REDACTED_ENTITIES = ["PERSON", "LOCATION", "ORGANIZATION", "DATE_TIME"]

class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    redacted_text: str
    entities_found: list[str]

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_and_anonymize(req: AnalyzeRequest):
    if not req.text:
        return AnalyzeResponse(redacted_text="", entities_found=[])
        
    try:
        # 1. Analyze text for specific entities
        results = analyzer.analyze(
            text=req.text,
            language="en",
            entities=REDACTED_ENTITIES
        )
        
        # 2. Anonymize the text using placeholders
        anonymized_result = anonymizer.anonymize(
            text=req.text,
            analyzer_results=results
        )
        
        # Extract unique entities found
        entities_found = list(set([res.entity_type for res in results]))
        
        return AnalyzeResponse(
            redacted_text=anonymized_result.text,
            entities_found=entities_found
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
