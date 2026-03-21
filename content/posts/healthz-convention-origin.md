---
title: 'Where Does the Convention of Using /healthz for Application Health Checks Come From?'
excerpt: 'Discover the origins of the /healthz endpoint convention for application health checks and why it has become a standard in modern software development.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2025-03-10'
publishedAt: '2025-03-10T09:00:00Z'
updatedAt: '2025-11-23T09:00:00Z'
readingTime: '5 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Health Checks
  - DevOps
  - Application Monitoring
---

## Introduction

The `/healthz` endpoint is a widely used convention for application health checks. It provides a simple way for systems to verify the health of an application or service. But where does this convention come from, and why has it become so popular?

In this guide, you'll learn about the origins of `/healthz`, its purpose, and how it fits into modern software development practices.

## The Origins of /healthz

The `/healthz` convention originated in the Kubernetes ecosystem. Kubernetes uses `/healthz` endpoints to check the health of system components like the API server. Over time, this convention was adopted by developers for their own applications.

### Why /healthz?

- **Simplicity**: The `/healthz` endpoint is easy to implement and understand.
- **Standardization**: Using a common endpoint name makes it easier for tools and systems to integrate.
- **Backward Compatibility**: The `z` in `/healthz` was added to avoid conflicts with existing `/health` endpoints.

```
+-------------------+
|   Application     |
|                   |
| +---------------+ |
| |   /healthz    | |
| +---------------+ |
| +---------------+ |
| |   Monitoring  | |
| +---------------+ |
| +---------------+ |
| |   Alerts      | |
| +---------------+ |
+-------------------+
```

## Implementing /healthz in Your Application

### Example in Node.js

```javascript
const express = require('express');
const app = express();

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

This code creates a simple `/healthz` endpoint that returns a 200 status code and an `OK` message.

### Example in Python

```python
from flask import Flask
app = Flask(__name__)

@app.route('/healthz')
def healthz():
    return "OK", 200

if __name__ == '__main__':
    app.run(port=3000)
```

This Python example achieves the same functionality using Flask.

## Best Practices for Health Checks

- **Keep It Lightweight**: Ensure the `/healthz` endpoint responds quickly and doesn't perform heavy operations.
- **Use HTTP Status Codes**: Return `200` for healthy and `500` for unhealthy states.
- **Monitor Regularly**: Integrate `/healthz` checks into your monitoring tools.

## Conclusion

The `/healthz` convention has become a standard for application health checks due to its simplicity and effectiveness. By implementing `/healthz` in your applications, you can provide a reliable way for systems to monitor and ensure the health of your services.
