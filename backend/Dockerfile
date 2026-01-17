FROM python:3.9-slim

# Install system dependencies for geospatial libraries
RUN apt-get update && apt-get install -y \
    libspatialindex-dev \
    libgdal-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8000

# Expose the port
EXPOSE 8000

# Command to run the application
CMD uvicorn api.main:app --host 0.0.0.0 --port $PORT
