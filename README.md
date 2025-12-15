# 🔔 Notification Service

Microservicio de notificaciones en tiempo real para el sistema de pedidos.

## 🎯 Funcionalidad

- Consume eventos de RabbitMQ: `order.created` y `order.ready`
- Envía notificaciones en tiempo real a clientes conectados vía **SSE** (Server-Sent Events)
- Mantiene múltiples conexiones simultáneas

## 🏗️ Arquitectura

```
RabbitMQ → Consumer → NotificationService → SSE → Frontend
```

### Componentes (SOLID)

1. **app.ts**: Servidor Express + endpoint SSE
2. **consumer.ts**: Conexión y consumo de RabbitMQ
3. **notificationService.ts**: Lógica de notificaciones (Observer pattern)
4. **types/index.ts**: Tipos TypeScript

## 🚀 Uso

### Desarrollo local
```bash
npm install
npm run dev
```

### Con Docker
```bash
docker build -t notification-service .
docker run -p 3003:3003 notification-service
```

## 📡 API

### SSE Endpoint
**GET** `/notifications/stream`

Conecta el cliente para recibir notificaciones en tiempo real.

**Formato de notificación:**
```json
{
  "id": "1234567890",
  "type": "success",
  "message": "¡Tu pedido #ABC123 está listo para recoger!",
  "orderId": "ABC123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Health Check
**GET** `/health`

## 🎨 Frontend - Ejemplo de Conexión

```javascript
// React Hook para conectar con SSE
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3003/notifications/stream');
    
    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [...prev, notification]);
    };

    eventSource.onerror = () => {
      console.error('Error en conexión SSE');
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return notifications;
};
```

## 🔄 Flujo de Notificaciones

1. **Order Service** crea pedido → Publica `order.created` a RabbitMQ
2. **Kitchen Service** termina pedido → Publica `order.ready` a RabbitMQ
3. **Notification Service** consume ambos eventos
4. Crea notificación con mensaje en español
5. Envía a todos los clientes conectados vía SSE

## 🛠️ Variables de Entorno

```env
PORT=3003
RABBITMQ_URL=amqp://rabbitmq:5672
```

## 📝 Tipos de Notificación

- `info`: Pedido recibido (order.created)
- `success`: Pedido listo (order.ready)
- `warning`: (Futuro uso)