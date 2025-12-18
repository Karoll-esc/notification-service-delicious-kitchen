/**
 * Interface para servicios de notificación
 * 
 * Cumple con Dependency Inversion Principle:
 * - Los módulos de alto nivel no dependen de módulos de bajo nivel
 * - Ambos dependen de abstracciones (esta interface)
 * 
 * Cumple con Interface Segregation Principle:
 * - Interface específica para notificaciones de órdenes
 * - Clientes no dependen de métodos que no usan
 */
export interface INotificationService {
  /**
   * Envía notificación cuando un pedido está listo
   * 
   * @param orderNumber - Número de la orden
   * @param customerName - Nombre del cliente
   * @param customerEmail - Email del cliente
   * @param items - Items del pedido
   * @returns Promise<boolean> - true si el envío fue exitoso
   */
  sendOrderReadyNotification(
    orderNumber: string,
    customerName: string,
    customerEmail: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): Promise<boolean>;

  /**
   * Envía notificación cuando un pedido está en preparación
   * 
   * @param orderNumber - Número de la orden
   * @param customerName - Nombre del cliente
   * @param customerEmail - Email del cliente
   * @param items - Items del pedido
   * @returns Promise<boolean> - true si el envío fue exitoso
   */
  sendOrderPreparingNotification(
    orderNumber: string,
    customerName: string,
    customerEmail: string,
    items: Array<{ name: string; quantity: number; price?: number }>
  ): Promise<boolean>;

  /**
   * Cierra conexiones y libera recursos
   */
  close(): Promise<void>;
}
