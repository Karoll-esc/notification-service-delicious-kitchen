# 🔔 Notification Service

Microservicio de notificaciones para el sistema de pedidos de Delicious Kitchen.

## 🎯 Funcionalidad

### Notificaciones Online (SSE)
- Consume eventos de RabbitMQ: `order.created`, `order.received`, `order.preparing`, `order.ready`, `order.cancelled`
- Envía notificaciones en tiempo real a clientes conectados vía **SSE** (Server-Sent Events)
- Mantiene múltiples conexiones simultáneas

### Notificaciones Offline (Email) 🆕
- Envía emails automáticamente cuando un pedido está listo (`order.ready`)
- Usa Gmail SMTP (gratis hasta 500 emails/día)
- Retry automático con backoff exponencial
- Validación de emails y datos requeridos
- Template HTML responsive

## 🏗️ Arquitectura

```
RabbitMQ → Consumer → NotificationService (SSE) → Frontend (Online)
                   ↘ EmailNotificationService (SMTP) → Cliente (Offline)
```

### Componentes (SOLID)

1. **app.ts**: Servidor Express + endpoint SSE
2. **rabbitmq/consumer.ts**: Conexión y consumo de RabbitMQ
3. **services/notificationService.ts**: Lógica de notificaciones SSE (Observer pattern)
4. **services/EmailNotificationService.ts**: Lógica de notificaciones por email 🆕
5. **interfaces/INotificationService.ts**: Interfaz para servicios de notificación 🆕
6. **types/index.ts**: Tipos TypeScript

## 🚀 Uso

### Desarrollo local
```bash
npm install
npm run dev
```

### Con Docker
```bash
cd infrastructure-delicious-kitchen
docker-compose up notification-service
```

## 📧 Configuración de Email (Nuevo)

### Requisitos:
1. Cuenta de Gmail con verificación en dos pasos habilitada
2. Contraseña de Aplicación generada

### Configurar variables de entorno:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-contraseña-de-aplicacion
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

**📖 Ver guía completa**: [SMTP_SETUP_GUIDE.md](./SMTP_SETUP_GUIDE.md)

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

### Online (SSE):
1. **Order Service** actualiza estado → Publica evento a RabbitMQ
2. **Notification Service** consume evento
3. Crea notificación con mensaje en español
4. Envía a todos los clientes conectados vía SSE

### Offline (Email): 🆕
1. **Order Service** actualiza estado a "READY" → Publica `order.ready` a RabbitMQ
2. **Notification Service** consume evento
3. **EmailNotificationService** valida datos del cliente
4. Envía email transaccional vía Gmail SMTP
5. Retry automático si falla (3 intentos con backoff exponencial)

## 🛠️ Variables de Entorno

### Básicas:
```env
PORT=3003
RABBITMQ_URL=amqp://rabbitmq:5672
```

### Email (Nuevo): 🆕
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-contraseña-de-aplicacion
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

## 📝 Tipos de Notificación

- `info`: Pedido creado/recibido (order.created, order.received)
- `warning`: Pedido en preparación/cancelado (order.preparing, order.cancelled)
- `success`: Pedido listo (order.ready) → **Envía email** 🆕

## 🧪 Testing

### Pruebas End-to-End:
Ver guía completa: [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md)

**6 casos de prueba cubiertos**:
1. Email enviado exitosamente
2. Validación de campos requeridos
3. Retry automático ante fallo
4. Email inválido
5. Cliente offline (solo email)
6. Cliente online (SSE + Email)

### Verificar logs:
```bash
docker logs delicious-notification-service -f
```

## 📚 Documentación Adicional

- 📧 **[SMTP_SETUP_GUIDE.md](./SMTP_SETUP_GUIDE.md)**: Configuración paso a paso de Gmail SMTP
- 🧪 **[E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md)**: Guía de pruebas end-to-end
- 📊 **[HU-024-IMPLEMENTATION-SUMMARY.md](./HU-024-IMPLEMENTATION-SUMMARY.md)**: Resumen ejecutivo de implementación

## 🏆 Principios SOLID Aplicados

- ✅ **Single Responsibility**: Cada servicio tiene una sola responsabilidad
- ✅ **Open/Closed**: Extensible mediante interfaces sin modificar código existente
- ✅ **Liskov Substitution**: Implementaciones sustituibles vía INotificationService
- ✅ **Interface Segregation**: Interfaces específicas y minimalistas
- ✅ **Dependency Inversion**: Depende de abstracciones, no implementaciones

## 🔐 Seguridad

- ✅ Validación de emails antes de enviar
- ✅ No expone credenciales SMTP en logs
- ✅ Usa "Contraseñas de Aplicación" de Gmail (no contraseña real)
- ✅ Variables de entorno para secretos
- ✅ Rate limiting implícito (Gmail: 500 emails/día)

## 📊 Monitoreo

### Ver métricas:
```bash
# Emails enviados hoy
docker logs delicious-notification-service 2>&1 | grep "Email enviado" | wc -l

# Errores de email
docker logs delicious-notification-service --since 24h 2>&1 | grep "Error al enviar email"

# Clientes SSE conectados
docker logs delicious-notification-service 2>&1 | grep "Cliente conectado"
```

## 🐛 Troubleshooting

### Email no se envía
1. Verificar variables SMTP: `docker exec delicious-notification-service env | grep SMTP`
2. Ver logs: `docker logs delicious-notification-service --tail 50`
3. Consultar: [SMTP_SETUP_GUIDE.md#troubleshooting](./SMTP_SETUP_GUIDE.md#troubleshooting)

### SSE no conecta
1. Verificar puerto 3003 accesible
2. Verificar CORS configurado en frontend
3. Ver logs de conexión: `docker logs delicious-notification-service -f`