import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Response } from 'express';
import notificationService from '../../src/services/notificationService';
import { OrderEvent } from '../../src/types';

/**
 * Tests de integración - Simulan el flujo completo del servicio
 */
describe('Notification Service - Integration Tests', () => {
  let mockClients: Array<{ write: jest.Mock; id: string }>;

  beforeEach(() => {
    // Limpiar clientes
    // @ts-ignore
    notificationService['clients'] = [];

    // Crear múltiples clientes mock
    mockClients = [
      { write: jest.fn(), id: 'client1' },
      { write: jest.fn(), id: 'client2' },
      { write: jest.fn(), id: 'client3' },
    ];

    jest.spyOn(console, 'log').mockImplementation(() => {}); 
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Flujo completo: order.created', () => {
    it('debe notificar a todos los clientes cuando se crea un pedido', () => {
      mockClients.forEach((client) => {
        notificationService.addClient(client as any);
      });

      const event: OrderEvent = {
        orderId: 'ORDER-123',
        type: 'order.created',
        timestamp: new Date('2024-01-15T10:30:00Z'),
      };

      notificationService.handleOrderEvent(event);

      mockClients.forEach((client) => {
        expect(client.write).toHaveBeenCalledTimes(2);

        const notification = client.write.mock.calls[1][0];
        expect(notification).toContain('Pedido #ORDER-123 recibido correctamente');
        expect(notification).toContain('"type":"info"');
      });
    });
  });

  describe('Flujo completo: order.ready', () => {
    it('debe notificar a todos los clientes cuando un pedido está listo', () => {
      mockClients.forEach((client) => {
        notificationService.addClient(client as any);
      });

      const event: OrderEvent = {
        orderId: 'ORDER-456',
        type: 'order.ready',
        timestamp: new Date('2024-01-15T10:35:00Z'),
      };

      notificationService.handleOrderEvent(event);

      mockClients.forEach((client) => {
        const notification = client.write.mock.calls[1][0];
        expect(notification).toContain('¡Tu pedido #ORDER-456 está listo para recoger!');
        expect(notification).toContain('"type":"success"');
      });
    });
  });

  describe('Escenario: Cliente se conecta tarde', () => {
    it('cliente que se conecta después no recibe notificaciones anteriores', () => {
      notificationService.addClient(mockClients[0] as any);
      notificationService.addClient(mockClients[1] as any);

      const event1: OrderEvent = {
        orderId: 'FIRST',
        type: 'order.created',
        timestamp: new Date(),
      };
      notificationService.handleOrderEvent(event1);

      notificationService.addClient(mockClients[2] as any);

      expect(mockClients[2].write).toHaveBeenCalledTimes(1);

      const event2: OrderEvent = {
        orderId: 'SECOND',
        type: 'order.ready',
        timestamp: new Date(),
      };
      notificationService.handleOrderEvent(event2);

      mockClients.forEach((client) => {
        const calls = client.write.mock.calls as any[];  // ✅ FIX
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall).toContain('SECOND');
      });
    });
  });

  describe('Escenario: Cliente se desconecta', () => {
    it('cliente desconectado no recibe más notificaciones', () => {
      mockClients.forEach((client) => {
        notificationService.addClient(client as any);
      });

      const event1: OrderEvent = {
        orderId: 'FIRST',
        type: 'order.created',
        timestamp: new Date(),
      };
      notificationService.handleOrderEvent(event1);

      expect(mockClients[0].write).toHaveBeenCalled();
      expect(mockClients[1].write).toHaveBeenCalled();
      expect(mockClients[2].write).toHaveBeenCalled();

      notificationService.removeClient(mockClients[1] as any);
      const client1Calls = mockClients[1].write.mock.calls.length;

      const event2: OrderEvent = {
        orderId: 'SECOND',
        type: 'order.ready',
        timestamp: new Date(),
      };
      notificationService.handleOrderEvent(event2);

      expect(mockClients[1].write).toHaveBeenCalledTimes(client1Calls);

      expect(mockClients[0].write).toHaveBeenCalledTimes(3);
      expect(mockClients[2].write).toHaveBeenCalledTimes(3);
    });
  });

  describe('Escenario: Múltiples eventos en secuencia', () => {
    it('debe manejar múltiples eventos consecutivos correctamente', () => {
      const client = mockClients[0];
      notificationService.addClient(client as any);

      const events: OrderEvent[] = [
        { orderId: 'ORDER-789', type: 'order.created', timestamp: new Date() },
        { orderId: 'ORDER-789', type: 'order.ready', timestamp: new Date() },
      ];

      events.forEach((event) => {
        notificationService.handleOrderEvent(event);
      });

      expect(client.write).toHaveBeenCalledTimes(3);

      const calls = client.write.mock.calls as any[];  // ✅ FIX
      
      expect(calls[1][0]).toContain('recibido correctamente');
      expect(calls[1][0]).toContain('"type":"info"');

      expect(calls[2][0]).toContain('listo para recoger');
      expect(calls[2][0]).toContain('"type":"success"');
    });
  });

  describe('Escenario: Alta concurrencia', () => {
    it('debe manejar muchos clientes simultáneos', () => {
      const manyClients = Array.from({ length: 50 }, (_, i) => ({
        write: jest.fn(),
        id: `client-${i}`,
      }));

      manyClients.forEach((client) => {
        notificationService.addClient(client as any);
      });

      const event: OrderEvent = {
        orderId: 'STRESS-TEST',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      manyClients.forEach((client) => {
        expect(client.write).toHaveBeenCalledTimes(2);
        const notification = client.write.mock.calls[1][0];
        expect(notification).toContain('STRESS-TEST');
      });
    });
  });

  describe('Formato de datos', () => {
    it('debe incluir todos los campos requeridos en la notificación', () => {
      const client = mockClients[0];
      notificationService.addClient(client as any);

      const event: OrderEvent = {
        orderId: 'TEST-FORMAT',
        type: 'order.created',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        data: { items: ['Pizza', 'Coca-Cola'] },
      };

      notificationService.handleOrderEvent(event);

      const notificationStr = client.write.mock.calls[1][0] as string;  // ✅ FIX
      const jsonStr = notificationStr.replace('data: ', '').replace('\n\n', '');
      const notification = JSON.parse(jsonStr);

      expect(notification).toMatchObject({
        id: expect.any(String),
        type: expect.stringMatching(/^(info|success|warning)$/),
        message: expect.any(String),
        orderId: 'TEST-FORMAT',
        timestamp: expect.any(String),
      });
    });

    it('debe generar IDs únicos para cada notificación', () => {
      const client = mockClients[0];
      notificationService.addClient(client as any);

      const events: OrderEvent[] = [
        { orderId: 'ORDER-1', type: 'order.created', timestamp: new Date() },
        { orderId: 'ORDER-2', type: 'order.created', timestamp: new Date() },
        { orderId: 'ORDER-3', type: 'order.created', timestamp: new Date() },
      ];

      events.forEach((event) => notificationService.handleOrderEvent(event));

      const ids = client.write.mock.calls.slice(1).map((call: any[]) => {  // ✅ FIX
        const jsonStr = (call[0] as string).replace('data: ', '').replace('\n\n', '');
        return JSON.parse(jsonStr).id;
      });

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Performance', () => {
    it('debe procesar eventos rápidamente', () => {
      const client = mockClients[0];
      notificationService.addClient(client as any);

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const event: OrderEvent = {
          orderId: `ORDER-${i}`,
          type: i % 2 === 0 ? 'order.created' : 'order.ready',
          timestamp: new Date(),
        };
        notificationService.handleOrderEvent(event);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});