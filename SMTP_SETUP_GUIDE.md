# 📧 Guía de Configuración SMTP para Notificaciones por Email

## 🎯 Propósito

Este servicio envía notificaciones por email cuando un pedido está listo, permitiendo que los clientes reciban alertas incluso si no están conectados online (navegador cerrado, sin conexión SSE).

---

## ✅ Configuración Rápida con Gmail (Recomendado)

### Paso 1: Habilitar Verificación en Dos Pasos

1. Ve a [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Busca "Verificación en dos pasos"
3. Habilítala si no la tienes activada (es requisito obligatorio)

### Paso 2: Generar Contraseña de Aplicación

1. En la misma página de seguridad, busca "Contraseñas de aplicación"
2. Haz clic en "Contraseñas de aplicación"
3. Selecciona:
   - **App**: Correo
   - **Device**: Otro (dispositivo personalizado)
4. Ponle un nombre: "Delicious Kitchen Notifications"
5. Haz clic en "Generar"
6. **Copia la contraseña generada** (16 caracteres sin espacios)
   - ⚠️ **IMPORTANTE**: Esta contraseña solo se muestra una vez

### Paso 3: Configurar Variables de Entorno

Edita el archivo `infrastructure-delicious-kitchen/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # La contraseña generada en paso 2
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

### Paso 4: Reiniciar el Servicio

```bash
cd infrastructure-delicious-kitchen
docker-compose restart notification-service
```

### Paso 5: Verificar Logs

```bash
docker logs delicious-notification-service -f
```

Deberías ver:

```
✅ [EmailService] SMTP configurado correctamente
✅ [EmailService] Conexión verificada con smtp.gmail.com
```

---

## 🧪 Pruebas Manuales

### Probar envío de email completo:

1. Crea un pedido en el frontend
2. En cocina, cambia el estado del pedido a "READY"
3. Verifica que llegó el email al correo del cliente

### Verificar logs:

```bash
# Ver logs del notification-service
docker logs delicious-notification-service --tail 50

# Filtrar solo logs de email
docker logs delicious-notification-service 2>&1 | grep EmailService
```

**Logs esperados cuando se envía un email:**

```
📨 Evento recibido: order.ready - Order #67890abcdef12345
✅ [EmailService] Email enviado a cliente@ejemplo.com
   Order Number: ORD-2024-001
   Attempt: 1/3
```

**Logs esperados si hay error:**

```
❌ [EmailService] Error al enviar email (intento 1/3): Invalid login
⏳ [EmailService] Reintentando en 2s...
```

---

## 🔧 Troubleshooting

### ❌ Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Causa**: Contraseña incorrecta o no estás usando una "Contraseña de Aplicación"

**Solución**:
- ✅ Verifica que habilitaste la verificación en dos pasos
- ✅ Genera una nueva "Contraseña de Aplicación" específica para esta app
- ✅ NO uses tu contraseña real de Gmail
- ✅ Copia la contraseña sin espacios (xxxx-xxxx-xxxx-xxxx → xxxxxxxxxxxxxxxx)

### ❌ Error: "Connection timeout"

**Causa**: Puerto bloqueado o servidor SMTP inaccesible

**Solución**:
- ✅ Verifica que `SMTP_PORT=587` (TLS)
- ✅ Si estás en una red corporativa, puede que bloqueen el puerto 587
- ✅ Alternativa: Usa puerto 465 con `SMTP_SECURE=true`

### ⚠️ Warning: "Credenciales SMTP no configuradas"

**Causa**: Variables de entorno faltantes o vacías

**Solución**:
1. Verifica que `.env` tenga todas las variables:
   ```bash
   cat infrastructure-delicious-kitchen/.env | grep SMTP
   ```
2. Reinicia el servicio:
   ```bash
   docker-compose restart notification-service
   ```

### 📧 Email no llega (sin errores en logs)

**Causa**: Email marcado como spam o filtrado

**Solución**:
- ✅ Revisa la carpeta de SPAM/Correo no deseado
- ✅ Agrega `noreply@deliciouskitchen.com` a contactos permitidos
- ✅ Verifica que el email del cliente sea válido

---

## 🔄 Alternativas a Gmail

### SendGrid (100 emails/día gratis)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

### Mailgun (Flex Plan: paga por uso)

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@sandbox-xxxxx.mailgun.org
SMTP_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

### Mailtrap (Solo para desarrollo/testing)

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=xxxxxxxxxxxxxxxx
SMTP_PASSWORD=xxxxxxxxxxxxxxxx
EMAIL_FROM="Delicious Kitchen <noreply@deliciouskitchen.com>"
```

---

## 📊 Monitoreo

### Ver métricas de emails enviados:

```bash
# Contar emails enviados exitosamente
docker logs delicious-notification-service 2>&1 | grep "Email enviado" | wc -l

# Ver últimos 10 emails enviados
docker logs delicious-notification-service 2>&1 | grep "Email enviado" | tail -10

# Ver errores de email en las últimas 24 horas
docker logs delicious-notification-service --since 24h 2>&1 | grep "Error al enviar email"
```

---

## 🔐 Seguridad

### ✅ Buenas Prácticas

- **NUNCA** subas el archivo `.env` al repositorio
- **NUNCA** uses tu contraseña real de Gmail en `SMTP_PASSWORD`
- **SIEMPRE** usa "Contraseña de Aplicación" específica
- **REVOCA** la contraseña de aplicación si es comprometida
- **LIMITA** el rate limit de emails (actualmente: sin límite explícito)

### 🛡️ Protección contra Spam

El servicio incluye:
- ✅ Validación de email antes de enviar
- ✅ Retry con backoff exponencial (3 intentos)
- ✅ Logs detallados de cada envío
- ✅ Envío asíncrono (no bloquea el flujo principal)

---

## 📚 Arquitectura

### Flujo de Ejecución:

```
Order Service                RabbitMQ              Notification Service
     |                          |                          |
     | 1. updateStatus('ready') |                          |
     |------------------------->|                          |
     |                          |                          |
     |                          | 2. order.ready event    |
     |                          |------------------------->|
     |                          |                          |
     |                          |                          | 3. SSE Broadcast
     |                          |                          |    (online users)
     |                          |                          |
     |                          |                          | 4. Send Email
     |                          |                          |    (offline users)
     |                          |                          |
     |                          |                          | 5. SMTP Gmail
     |                          |                          |--------------->
     |                          |                          |     📧
     |                          |                          |<---------------
     |                          |                          |   "Email sent!"
```

### Principios SOLID Aplicados:

- **Single Responsibility**: EmailNotificationService solo maneja emails
- **Open/Closed**: Extensible para nuevos tipos de notificaciones
- **Liskov Substitution**: Implementa INotificationService
- **Interface Segregation**: Interfaz minimalista y específica
- **Dependency Inversion**: Depende de abstracciones (Transporter)

---

## 📞 Soporte

Si encuentras problemas no documentados aquí:

1. Revisa los logs completos: `docker logs delicious-notification-service`
2. Verifica las variables de entorno: `docker exec delicious-notification-service env | grep SMTP`
3. Prueba la conexión SMTP manualmente con telnet:
   ```bash
   telnet smtp.gmail.com 587
   ```

---

## 📝 Changelog

### v1.0.0 (2024)
- ✅ Implementación inicial con Gmail SMTP
- ✅ Retry automático con backoff exponencial
- ✅ Template HTML responsive
- ✅ Validación de email
- ✅ Logs estructurados
- ✅ Integración con RabbitMQ consumer
