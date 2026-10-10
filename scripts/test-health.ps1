$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health"
$response | ConvertTo-Json
