import nodemailer, { Transporter } from 'nodemailer';
import { INotificationService } from '../interfaces/INotificationService';

/**
 * Servicio de notificaciones por email
 * 
 * Cumple con Single Responsibility Principle: Solo maneja envío de emails
 * 
 * HU-024: Manejo de Notificaciones Offline
 * 
 * Casos de uso:
 * - Cliente cierra el navegador → Recibe email cuando pedido está listo
 * - Fallback si SSE/WebSocket no funciona
 * 
 * Configuración:
 * - Usa Nodemailer con Gmail SMTP (gratis hasta 500 emails/día)
 * - Variables de entorno: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 */
export class EmailNotificationService implements INotificationService {
  private transporter!: Transporter;  // Definite assignment assertion
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Inicializa el transporter de email
   * Cumple con Dependency Inversion: Depende de abstracción (Transporter)
   */
  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    // Validar que las credenciales estén configuradas
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.warn('⚠️  [EmailService] Credenciales SMTP no configuradas. Emails NO se enviarán.');
      console.warn('    Configura SMTP_HOST, SMTP_USER y SMTP_PASSWORD en .env');
      this.isConfigured = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPassword
      }
    });

    this.isConfigured = true;
    this.verifyConnection();
  }

  /**
   * Verifica que la configuración SMTP sea válida
   * Cumple con Fail Fast: Detecta errores al inicio
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      console.log('✅ [EmailService] Conexión SMTP verificada correctamente');
    } catch (error: any) {
      console.error('❌ [EmailService] Error al verificar conexión SMTP:', error.message);
      console.warn('⚠️  Emails NO se enviarán. Revisa las credenciales en .env');
      this.isConfigured = false;
    }
  }

  /**
   * Envía notificación de pedido listo
   * 
   * Cumple con Interface Segregation: Método específico y bien definido
   * 
   * @param orderNumber - Número de orden (ej: "ORD-20241217-001")
   * @param customerName - Nombre del cliente
   * @param customerEmail - Email del cliente
   * @param items - Items del pedido
   * @returns Promise<boolean> - true si envío exitoso, false si falló
   */
  async sendOrderReadyNotification(
    orderNumber: string,
    customerName: string,
    customerEmail: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): Promise<boolean> {
    // Guard clause: Si no está configurado, retornar false sin lanzar error
    if (!this.isConfigured) {
      console.warn(`⚠️  [EmailService] Servicio no configurado. Email no enviado para orden ${orderNumber}`);
      return false;
    }

    // Validar datos de entrada (fail fast)
    if (!this.isValidEmail(customerEmail)) {
      console.warn(`⚠️  [EmailService] Email inválido para orden ${orderNumber}: ${customerEmail}`);
      return false;
    }

    if (!orderNumber || !customerName || !items || items.length === 0) {
      console.warn(`⚠️  [EmailService] Datos incompletos para enviar email`);
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Delicious Kitchen" <noreply@deliciouskitchen.com>',
        to: customerEmail,
        subject: `� ¡Tu pedido está listo para recoger!`,
        html: this.generateReadyEmailTemplate(orderNumber, customerName, items),
        text: this.generatePlainTextEmail(orderNumber, customerName, items, 'ready')
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ [EmailService] Email 'READY' enviado a ${customerEmail}`);
      console.log(`   Order: ${orderNumber}`);
      console.log(`   MessageID: ${info.messageId}`);
      console.log(`   MessageID: ${info.messageId}`);
      
      return true;
    } catch (error: any) {
      console.error(`❌ [EmailService] Error al enviar email para orden ${orderNumber}:`, error.message);
      // No lanzar error - el flujo principal no debe romperse si falla el email
      return false;
    }
  }

  /**
   * Envía notificación cuando el pedido está en preparación
   * 
   * @param orderNumber - Número de orden (ej: "ORD-20241217-001")
   * @param customerName - Nombre del cliente
   * @param customerEmail - Email del cliente
   * @param items - Items del pedido
   * @returns Promise<boolean> - true si envío exitoso, false si falló
   */
  async sendOrderPreparingNotification(
    orderNumber: string,
    customerName: string,
    customerEmail: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`⚠️  [EmailService] Servicio no configurado. Email no enviado para orden ${orderNumber}`);
      return false;
    }

    if (!this.isValidEmail(customerEmail)) {
      console.warn(`⚠️  [EmailService] Email inválido para orden ${orderNumber}: ${customerEmail}`);
      return false;
    }

    if (!orderNumber || !customerName || !items || items.length === 0) {
      console.warn(`⚠️  [EmailService] Datos incompletos para enviar email`);
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Delicious Kitchen" <noreply@deliciouskitchen.com>',
        to: customerEmail,
        subject: `👨‍🍳 Tu pedido ya está en preparación`,
        html: this.generatePreparingEmailTemplate(orderNumber, customerName, items),
        text: this.generatePlainTextEmail(orderNumber, customerName, items, 'preparing')
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ [EmailService] Email 'PREPARING' enviado a ${customerEmail}`);
      console.log(`   Order: ${orderNumber}`);
      console.log(`   MessageID: ${info.messageId}`);
      
      return true;
    } catch (error: any) {
      console.error(`❌ [EmailService] Error al enviar email para orden ${orderNumber}:`, error.message);
      return false;
    }
  }

  /**
   * Valida formato de email
   * Cumple con Single Responsibility: Solo valida emails
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Genera versión de texto plano del email
   * Cumple con Open/Closed: Abierto para extensión (templates), cerrado para modificación
   */
  private generatePlainTextEmail(
    orderNumber: string, 
    customerName: string,
    items: Array<{ name: string; quantity: number; price?: number }>,
    type: 'ready' | 'preparing'
  ): string {
    const itemsList = items.map(item => `- ${item.quantity}x ${item.name}`).join('\n');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderUrl = `${frontendUrl}/orders/${orderNumber}`;

    if (type === 'preparing') {
      return `Hola ${customerName},

Sabemos que tienes hambre y queremos notificarte que tu pedido ya está en preparación.

Tu orden:
${itemsList}

Puedes ver el estado de tu pedido en:
${orderUrl}

¡Pronto estará listo!

Gracias por tu preferencia,
Equipo Delicious Kitchen

---
Este es un email automático, por favor no respondas a este mensaje.`;
    }

    // type === 'ready'
    return `Hola ${customerName},

¡Tenemos excelentes noticias! Tu pedido está listo para recoger.

Tu orden:
${itemsList}

Puedes ver el estado de tu pedido en:
${orderUrl}

También puedes dejar tu reseña aquí:
${orderUrl}

Por favor pasa por nuestro restaurante cuando puedas. ¡Tu comida te está esperando!

Gracias por tu preferencia,
Equipo Delicious Kitchen

---
Este es un email automático, por favor no respondas a este mensaje.`;
  }

  /**
   * Genera template HTML para email de pedido en preparación
   * Cumple con DRY: Template reutilizable
   * Cumple con Separation of Concerns: Lógica de presentación separada
   */
  private generatePreparingEmailTemplate(
    orderNumber: string, 
    customerName: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): string {
    const itemsHtml = items.map(item => 
      `<li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="color: #333333; font-weight: 500;">${item.quantity}x</span> 
        <span style="color: #666666;">${this.escapeHtml(item.name)}</span>
      </li>`
    ).join('');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderUrl = `${frontendUrl}/orders/${orderNumber}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pedido en Preparación</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff7e33 0%, #ff5722 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🍽️ Delicious Kitchen</h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0;">¡Hola ${this.escapeHtml(customerName)}! 👋</h2>
                    
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Sabemos que tienes hambre 😋, queremos notificarte que <strong style="color: #ff7e33;">tu pedido ya está en preparación</strong>.
                    </p>
                    
                    <div style="background-color: #fff5f0; border-left: 4px solid #ff7e33; padding: 20px; margin: 30px 0;">
                      <p style="color: #333333; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">Tu orden:</p>
                      <ul style="list-style: none; padding: 0; margin: 0;">
                        ${itemsHtml}
                      </ul>
                    </div>
                    
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 30px 0 20px 0;">
                      Nuestros chefs están trabajando en tu pedido. ¡Pronto estará listo! 👨‍🍳✨
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${orderUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff7e33 0%, #ff5722 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 5px rgba(255,126,51,0.3);">
                            Ver estado del pedido
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                      Gracias por tu preferencia,<br>
                      <strong style="color: #ff7e33;">Equipo Delicious Kitchen</strong>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      Este es un email automático, por favor no respondas a este mensaje.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Genera template HTML para email de pedido listo
   * Cumple con DRY: Template reutilizable
   * Cumple con Separation of Concerns: Lógica de presentación separada
   */
  private generateReadyEmailTemplate(
    orderNumber: string, 
    customerName: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): string {
    const itemsHtml = items.map(item => 
      `<li style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="color: #333333; font-weight: 500;">${item.quantity}x</span> 
        <span style="color: #666666;">${this.escapeHtml(item.name)}</span>
      </li>`
    ).join('');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderUrl = `${frontendUrl}/orders/${orderNumber}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pedido Listo</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff7e33 0%, #ff5722 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🍽️ Delicious Kitchen</h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0;">¡Hola ${this.escapeHtml(customerName)}! 👋</h2>
                    
                    <p style="color: #666666; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                      ¡Tenemos excelentes noticias! <strong style="color: #ff7e33;">Tu pedido está listo</strong> para recoger 🎉
                    </p>
                    
                    <div style="background-color: #fff5f0; border-left: 4px solid #ff7e33; padding: 20px; margin: 30px 0;">
                      <p style="color: #333333; font-size: 16px; margin: 0 0 15px 0; font-weight: bold;">Tu orden:</p>
                      <ul style="list-style: none; padding: 0; margin: 0;">
                        ${itemsHtml}
                      </ul>
                    </div>
                    
                    <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 30px 0 20px 0;">
                      Por favor pasa por nuestro restaurante cuando puedas. ¡Tu comida te está esperando! 🥘
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 10px 0;">
                          <a href="${orderUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff7e33 0%, #ff5722 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 2px 5px rgba(255,126,51,0.3);">
                            Ver estado del pedido
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 10px 0;">
                          <a href="${orderUrl}" style="display: inline-block; background-color: #ffffff; color: #ff7e33; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold; border: 2px solid #ff7e33;">
                            ⭐ Dejar una reseña
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                      Gracias por tu preferencia,<br>
                      <strong style="color: #ff7e33;">Equipo Delicious Kitchen</strong>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      Este es un email automático, por favor no respondas a este mensaje.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Escapa caracteres HTML para prevenir XSS
   * Cumple con Security Best Practices
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Cierra la conexión del transporter
   * Cumple con Resource Management: Libera recursos al cerrar
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      console.log('🔌 [EmailService] Conexión SMTP cerrada');
    }
  }
}

// Singleton - una sola instancia compartida
export default new EmailNotificationService();
