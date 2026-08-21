# Cloud Run Health Check Mapping

## Overview

This project adds liveness and readiness checks to the `orders-api` service so that the application's health can be monitored instead of relying only on whether the container process is running.

The local Docker Compose implementation provides the following health signals:

- `/health` — liveness check
- `/ready` — readiness/dependency check
- Docker `HEALTHCHECK` — container health monitoring
- `restart: unless-stopped` — local Docker restart policy

This document explains how these concepts map to Google Cloud Run. No Cloud Run deployment is performed as part of this assignment.

## Local Health Checks

### Liveness: `/health`

The `/health` endpoint performs a shallow check.

```text
GET /health
```

When the application process is running, it returns:

```text
200 OK
OK
```

The endpoint does not access the database. Therefore, a database failure does not make `/health` fail.

This represents the question:

> Is the application process alive?

### Readiness: `/ready`

The `/ready` endpoint performs a dependency check against PostgreSQL.

```text
GET /ready
```

When the database is reachable:

```text
200 OK
READY
```

When the database is unavailable:

```text
503 Service Unavailable
NOT READY
```

This represents the question:

> Is the application currently able to serve requests because its required dependency is available?

## Docker Compose Mapping

The local Compose configuration uses a container health check:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 10s
  timeout: 3s
  start_period: 20s
  retries: 3
```

The container runtime periodically calls `/health` and uses the response to determine whether the container is healthy.

The Compose service also uses:

```yaml
restart: unless-stopped
```

This provides a local Docker restart policy when the container process exits.

## Cloud Run Mapping

Cloud Run provides application health-check mechanisms that are conceptually similar to the checks implemented in this project.

### `/health` → Cloud Run liveness check

The local `/health` endpoint can be used as the application's liveness signal.

Its purpose is to determine whether the application process is functioning. It deliberately avoids checking the database so that a dependency failure is not incorrectly treated as a dead application process.

In a Cloud Run configuration, a liveness probe can target the application's HTTP health endpoint.

Conceptually:

```text
Cloud Run
   |
   | HTTP liveness check
   v
GET /health
   |
   +---- 200 → application is alive
   |
   +---- failure → application may need to be restarted
```

### `/ready` → readiness/dependency check

The `/ready` endpoint checks PostgreSQL and returns `503` when the dependency is unavailable.

Conceptually:

```text
Cloud Run
   |
   | readiness/dependency signal
   v
GET /ready
   |
   +---- 200 → ready to serve
   |
   +---- 503 → dependency unavailable
```

The key distinction is that readiness answers whether the application is capable of serving traffic, while liveness answers whether the application itself is still functioning.

## Local vs Cloud Behavior

| Local Docker Compose          | Cloud Run Concept                          |
| ----------------------------- | ------------------------------------------ |
| `/health`                     | Liveness check                             |
| `/ready`                      | Readiness/dependency signal                |
| Docker `HEALTHCHECK`          | Runtime health monitoring                  |
| `restart: unless-stopped`     | Local container restart policy             |
| `200 OK` from `/health`       | Application is alive                       |
| `200 READY` from `/ready`     | Dependencies are available                 |
| `503 NOT READY` from `/ready` | Application is not ready to serve normally |

## Important Difference

Docker Compose and Cloud Run do not have identical restart and health-check behavior.

A Docker Compose `HEALTHCHECK` can mark a container as `healthy` or `unhealthy`, but the `restart: unless-stopped` policy primarily controls what happens when the container process exits. A health check becoming `unhealthy` does not, by itself, mean that Docker Compose will restart the container.

Cloud Run manages container instances using its own health and lifecycle mechanisms. Therefore, the local Docker setup is a practical demonstration of health monitoring, while the Cloud Run configuration would use Cloud Run's supported startup and liveness mechanisms rather than simply copying the Compose configuration.

## Kubernetes Equivalent

The same application endpoints can also be mapped naturally to Kubernetes probes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
```

The distinction remains the same:

```text
/health
   ↓
Liveness
   ↓
"Is the process alive?"


/ready
   ↓
Readiness
   ↓
"Can the application serve requests?"
```

## Conclusion

The local implementation gives `orders-api` explicit health signals that the runtime can observe.

The important design principle is to keep the checks separate:

- `/health` is shallow and independent of the database.
- `/ready` verifies the database dependency.
- Docker monitors `/health` through its `HEALTHCHECK`.
- The application reports `503` from `/ready` when it cannot reach the database.
- Cloud Run can use the same application-level health endpoint as part of its health-check configuration.

No Cloud Run deployment is required for this assignment.
