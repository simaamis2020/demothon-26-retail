# Inventory Microservice Deployment Guide

## 🚀 Build and Deploy

### 1. Build the Docker Image
```bash
# Navigate to microservice directory
cd /path/to/microservice

# Build the image
docker build -t inventory-service:latest .

# Tag for minikube (if using minikube)
minikube image load inventory-service:latest
```

### 2. Deploy to Kubernetes
```bash
# Apply the deployment
kubectl apply -f k8s-inventory-deployment.yaml

# Check deployment status
kubectl get pods -l app=inventory-service
kubectl get svc inventory-service

# Check logs
kubectl logs -l app=inventory-service -f
```

### 3. Test the Service
```bash
# Port-forward for testing
kubectl port-forward svc/inventory-service 8080:80

# Test health endpoint
curl http://localhost:8080/health

# Test inventory update
curl -X POST http://localhost:8080/inventory/update \
  -H "Content-Type: application/json" \
  -d '{
    "customer_data": {
      "personalised_text": "Anna, I see you have a great preference for organic bananas"
    }
  }'

# Test inventory status
curl http://localhost:8080/inventory/status/94011
```

## 🏗️ Architecture Integration Options

### Option A: Replace Agent Completely
```
PWA → LangGraph Agent → Microservice → Database
                       (RELIABLE)
```

Update your gateway to route directly to the microservice:

```yaml
# In your gateway config
inventory_route:
  path: "/store/scan"
  target: "http://inventory-service/inventory/update"
  method: POST
```

### Option B: Hybrid Approach (Recommended)
```
PWA → LangGraph Agent → Microservice → Database
          ↓                ↓
     AI Features      Reliable Ops
```

Keep the agent for AI tasks, but let it call the microservice:

```python
# In your agent's tool
def update_inventory_via_service(plu, customer_data):
    response = requests.post("http://inventory-service/inventory/update", 
                           json={"customer_data": customer_data})
    return response.json()
```

### Option C: Agent as Demo Layer
```
PWA → Gateway → [Agent OR Microservice]
                    ↓         ↓
               Demo Mode  Production
```

Route based on request headers:
- Demo requests → Agent (for showcasing AI)
- Production → Microservice (for reliability)

## 🔧 Gateway Configuration Update

Update your `event-mesh-gateway` to include the microservice:

```yaml
# Add to your gateway config
services:
  - name: inventory-service
    url: http://inventory-service
    health_check: /health
    
routes:
  - path: /inventory/*
    service: inventory-service
    strip_prefix: /inventory
```

## 📊 Benefits of This Approach

### Microservice Advantages:
✅ **Reliable database updates** (proper transaction handling)
✅ **Fast response times** (no LLM overhead)  
✅ **Easy debugging** (standard logs, metrics)
✅ **Predictable scaling** (standard K8s patterns)
✅ **Production-ready** (health checks, graceful shutdown)

### Keep Agent For:
🤖 **Customer personalization** (AI-powered recommendations)
🤖 **Trend analysis** (complex pattern recognition)  
🤖 **Demo scenarios** (showcasing AI capabilities)
🤖 **Future AI features** (chatbot, predictions, etc.)

## 🎯 Next Steps

1. **Deploy the microservice** using the commands above
2. **Test thoroughly** with your existing data
3. **Update gateway routing** to use microservice for inventory updates
4. **Keep agent** for AI-powered features and demos
5. **Monitor** both services and compare reliability

This gives you the best of both worlds: bulletproof inventory operations + cool AI demo features!
