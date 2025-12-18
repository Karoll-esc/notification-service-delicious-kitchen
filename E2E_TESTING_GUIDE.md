# 🧪 Pruebas End-to-End: Notificaciones por Email

## 📋 Escenario de Prueba Completo

### Objetivo
Verificar que el sistema envía emails automáticamente cuando un pedido alcanza el estado "READY", permitiendo a clientes offline recibir notificaciones.

---

## ✅ Pre-requisitos

1. **Configuración SMTP completada** (ver `SMTP_SETUP_GUIDE.md`)
2. **Servicios ejecutándose en Docker**:
   ```bash
   cd infrastructure-delicious-kitchen
   docker-compose up -d
   ```
3. **Email de prueba válido** (puede ser tu propio Gmail)

---

## 🎯 Caso de Prueba 1: Email enviado exitosamente

### Pasos:

#### 1️⃣ Verificar configuración SMTP

```bash
# Ver variables de entorno del servicio
docker exec delicious-notification-service env | grep SMTP

# Verificar logs de inicio
docker logs delicious-notification-service --tail 20
```

**Resultado esperado**:
```
✅ [EmailService] SMTP configurado correctamente
✅ [EmailService] Conexión verificada con smtp.gmail.com
```

---

#### 2️⃣ Crear un pedido nuevo

**Frontend**: http://localhost:5173

1. Login como cajero (role: `cashier`)
2. Ir a "Crear Pedido"
3. Completar formulario:
   - **Nombre del cliente**: Juan Pérez
   - **Email del cliente**: tu-email-prueba@gmail.com ⚠️ **Usa tu email real**
   - **Ítems**: Agregar 2-3 productos
4. Enviar pedido
5. **Anotar el Order Number** (ej: `ORD-2024-001`)

---

#### 3️⃣ Verificar el pedido en cocina

**Frontend - Vista Cocina**: http://localhost:5173/kitchen

1. Login como cocinero (role: `kitchen`)
2. Verificar que el pedido aparece en estado "RECEIVED"
3. Cambiar estado a "PREPARING"
4. Cambiar estado a **"READY"** ⚠️ **Este cambio debe enviar el email**

---

#### 4️⃣ Verificar logs del notification-service

```bash
# Ver logs en tiempo real
docker logs delicious-notification-service -f

# Filtrar solo emails
docker logs delicious-notification-service 2>&1 | grep "EmailService"
```

**Resultado esperado**:
```
📨 Evento recibido: order.ready - Order #67890abcdef12345
✅ [EmailService] Email enviado a tu-email-prueba@gmail.com
   Order Number: ORD-2024-001
   Attempt: 1/3
   Response: 250 2.0.0 OK
```

---

#### 5️⃣ Verificar recepción del email

1. Abre tu bandeja de entrada (Gmail, Outlook, etc.)
2. Busca email de "Delicious Kitchen" o "noreply@deliciouskitchen.com"
3. Si no está en la bandeja principal, **revisa SPAM**

**Contenido esperado del email**:

- **Asunto**: "🎉 ¡Tu pedido ORD-2024-001 está listo!"
- **Cuerpo**:
  - Logo/Header de Delicious Kitchen
  - Mensaje personalizado con nombre del cliente
  - Número de orden destacado
  - Call-to-action: "Pasar a recogerlo"
  - Footer con información de contacto

---

## 🎯 Caso de Prueba 2: Validación de campos requeridos

### Objetivo
Verificar que el sistema NO envía email si faltan datos del cliente.

### Pasos:

#### 1️⃣ Crear pedido SIN email

**Nota**: Actualmente el frontend valida el email como obligatorio, por lo que este caso debe probarse a nivel de API directamente.

**Opción A: Postman/Thunder Client**

```http
POST http://localhost:3001/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "Cliente Sin Email",
  "customerEmail": "",  # Email vacío
  "items": [
    { "name": "Pizza", "quantity": 1, "price": 15.99 }
  ]
}
```

**Opción B: cURL**

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerName": "Cliente Sin Email",
    "customerEmail": "",
    "items": [{"name": "Pizza", "quantity": 1, "price": 15.99}]
  }'
```

#### 2️⃣ Cambiar estado a "READY"

#### 3️⃣ Verificar logs

**Resultado esperado**:
```
📨 Evento recibido: order.ready - Order #xxxxx
⚠️ Orden xxxxx lista pero faltan datos para email: {
  orderNumber: true,
  customerName: true,
  customerEmail: false  ← Email faltante
}
```

✅ **NO debe intentar enviar email**  
✅ **SSE notification debe funcionar normalmente**

---

## 🎯 Caso de Prueba 3: Retry automático ante fallo

### Objetivo
Verificar que el sistema reintenta enviar el email si falla el primer intento.

### Pasos:

#### 1️⃣ Simular fallo temporal (contraseña incorrecta)

```bash
# Modificar temporalmente .env
nano infrastructure-delicious-kitchen/.env

# Cambiar:
SMTP_PASSWORD=contraseña-incorrecta

# Reiniciar servicio
docker-compose restart notification-service
```

#### 2️⃣ Crear pedido y cambiar a "READY"

#### 3️⃣ Verificar logs

**Resultado esperado**:
```
❌ [EmailService] Error al enviar email (intento 1/3): Invalid login
⏳ [EmailService] Reintentando en 2s...
❌ [EmailService] Error al enviar email (intento 2/3): Invalid login
⏳ [EmailService] Reintentando en 4s...
❌ [EmailService] Error al enviar email (intento 3/3): Invalid login
❌ [EmailService] Falló después de 3 intentos
```

#### 4️⃣ Restaurar configuración

```bash
# Volver a poner la contraseña correcta
nano infrastructure-delicious-kitchen/.env
docker-compose restart notification-service
```

---

## 🎯 Caso de Prueba 4: Email inválido

### Objetivo
Verificar que el sistema valida emails antes de enviar.

### Pasos:

#### 1️⃣ Crear pedido con email inválido

```bash
# Via API con cURL
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerName": "Cliente Email Inválido",
    "customerEmail": "esto-no-es-un-email",
    "items": [{"name": "Pizza", "quantity": 1, "price": 15.99}]
  }'
```

#### 2️⃣ Cambiar estado a "READY"

#### 3️⃣ Verificar logs

**Resultado esperado**:
```
⚠️ [EmailService] Email inválido: esto-no-es-un-email
❌ [EmailService] No se intentará enviar email
```

---

## 🎯 Caso de Prueba 5: Cliente offline recibe email

### Objetivo
Simular que el cliente NO está conectado al frontend (navegador cerrado) y verifica que el email es el único medio de notificación.

### Pasos:

#### 1️⃣ Crear pedido normalmente

1. Login como cajero
2. Crear pedido con tu email
3. **Cerrar COMPLETAMENTE el navegador** (o usar ventana incógnito y cerrarla)

#### 2️⃣ Cambiar estado del pedido (desde otra sesión)

1. Abrir nuevo navegador
2. Login como cocinero
3. Cambiar pedido a "READY"

#### 3️⃣ Verificar que el email llegó

**Resultado esperado**:
- ✅ Email recibido en bandeja de entrada
- ✅ Logs muestran envío exitoso
- ❌ No hay cliente conectado por SSE (esperado)

---

## 🎯 Caso de Prueba 6: Cliente online recibe ambas notificaciones

### Objetivo
Verificar que un cliente conectado recibe TANTO la notificación SSE (online) COMO el email (backup).

### Pasos:

#### 1️⃣ Mantener cliente conectado

1. Login como cajero (o cliente si tienes esa vista)
2. **NO cerrar el navegador**
3. Abrir la consola del navegador (F12)
4. Verificar conexión SSE:
   ```javascript
   // En la consola del navegador
   console.log('EventSource readyState:', eventSource?.readyState);
   // Debe mostrar: 1 (OPEN)
   ```

#### 2️⃣ Crear pedido desde esa misma sesión

#### 3️⃣ Cambiar estado a "READY" (desde cocina)

#### 4️⃣ Verificar notificaciones

**Resultado esperado**:
- ✅ Notificación SSE aparece en el frontend inmediatamente
- ✅ Email recibido en bandeja de entrada (llega en 1-5 segundos)
- ✅ Logs muestran ambos:
  ```
  📢 Notificación enviada: ¡Tu pedido #ORD-2024-001 está listo para recoger!
  ✅ [EmailService] Email enviado a tu-email@gmail.com
  ```

---

## 📊 Resultados Esperados (Checklist)

### ✅ Funcionalidad

- [ ] Email se envía automáticamente cuando pedido cambia a "READY"
- [ ] Email NO se envía si faltan datos (email, nombre, orderNumber)
- [ ] Email NO se envía si el email es inválido
- [ ] Sistema reintenta hasta 3 veces si falla el envío
- [ ] SSE sigue funcionando normalmente (no afectado por emails)

### ✅ Contenido del Email

- [ ] Asunto contiene el Order Number
- [ ] Cuerpo incluye nombre del cliente personalizado
- [ ] Número de orden destacado visualmente
- [ ] Diseño responsive (funciona en móviles)
- [ ] Colores corporativos de Delicious Kitchen

### ✅ Logs y Monitoreo

- [ ] Logs claros de inicio de SMTP
- [ ] Logs de cada intento de envío
- [ ] Logs de errores con detalles técnicos
- [ ] Warnings cuando faltan configuraciones

### ✅ Seguridad

- [ ] No se exponen credenciales SMTP en logs
- [ ] Validación de email antes de enviar
- [ ] Envío asíncrono (no bloquea RabbitMQ consumer)

---

## 🐛 Troubleshooting Durante Pruebas

### Email no llega después de 5 minutos

1. **Verificar logs**:
   ```bash
   docker logs delicious-notification-service --tail 50
   ```

2. **Verificar configuración SMTP**:
   ```bash
   docker exec delicious-notification-service env | grep SMTP
   ```

3. **Revisar carpeta SPAM** en tu email

4. **Probar conexión SMTP manualmente**:
   ```bash
   docker exec -it delicious-notification-service sh
   npm install -g smtp-check
   smtp-check smtp.gmail.com 587
   ```

### Error "ECONNREFUSED" o "ETIMEDOUT"

- **Causa**: Puerto bloqueado o servidor SMTP inaccesible
- **Solución**: Verificar firewall, usar otro puerto (465), o cambiar de proveedor SMTP

### Error "Invalid login"

- **Causa**: Contraseña incorrecta o no es "Contraseña de Aplicación"
- **Solución**: Generar nueva contraseña de aplicación en Google

---

## 📝 Registro de Pruebas (Template)

### Fecha: _____________
### Tester: _____________

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Email enviado exitosamente | ✅ / ❌ | Order#: _______ |
| TC2: Validación campos requeridos | ✅ / ❌ | |
| TC3: Retry automático | ✅ / ❌ | Intentos: _____ |
| TC4: Email inválido | ✅ / ❌ | |
| TC5: Cliente offline | ✅ / ❌ | Tiempo recepción: _____s |
| TC6: Cliente online (dual) | ✅ / ❌ | SSE: ⏱ Email: ⏱ |

**Observaciones adicionales**:
```
_______________________________________________________
_______________________________________________________
_______________________________________________________
```

---

## 🚀 Automatización Futura

### Scripts de Testing (Opcional)

Crear en `tests/e2e/email-notifications.test.ts`:

```typescript
describe('Email Notifications E2E', () => {
  it('should send email when order is ready', async () => {
    // 1. Create order
    const order = await createTestOrder({
      customerEmail: 'test@example.com'
    });
    
    // 2. Update to READY
    await updateOrderStatus(order.id, 'READY');
    
    // 3. Verify email was sent (check logs or use email testing service)
    const logs = await getServiceLogs('notification-service');
    expect(logs).toContain('Email enviado a test@example.com');
  });
});
```

### Integración con Mailtrap (Testing)

Para pruebas automatizadas sin enviar emails reales:

```env
# En .env para ambiente de testing
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=xxxxx
SMTP_PASSWORD=xxxxx
```

Luego verificar emails en https://mailtrap.io/inboxes

---

## 📞 Contacto

Si algún test falla de forma inesperada:
1. Captura los logs completos
2. Captura screenshot del error
3. Documenta los pasos exactos que seguiste
4. Reporta en el issue tracker del proyecto
