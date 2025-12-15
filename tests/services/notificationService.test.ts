import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';  // ← AGREGAR
import { Response } from 'express';
import notificationService from '../../src/services/notificationService';
import { OrderEvent } from '../../src/types';

describe('NotificationService', () => {
  // Mock de Response de Express
  let mockResponse: Partial<Response>;
  let writeSpy: jest.Mock;

  beforeEach(() => {
    // Crear mock de response con spy en write
    writeSpy = jest.fn();
    mockResponse = {
      write: writeSpy,
      on: jest.fn(),
      end: jest.fn(),
    } as any;

    // Limpiar estado del servicio
    // @ts-ignore - Acceder a propiedad privada para testing
    notificationService['clients'] = [];
  });

  describe('addClient', () => {
    it('debe agregar un cliente a la lista', () => {
      notificationService.addClient(mockResponse as Response);

      // @ts-ignore
      const clients = notificationService['clients'];
      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(mockResponse);
    });

    it('debe enviar mensaje de bienvenida al conectar', () => {
      notificationService.addClient(mockResponse as Response);

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const callArg = writeSpy.mock.calls[0][0];
      expect(callArg).toContain('data:');
      expect(callArg).toContain('Conectado al sistema de notificaciones');
    });

    it('debe soportar múltiples clientes', () => {
      const client1 = { write: jest.fn() } as any;
      const client2 = { write: jest.fn() } as any;
      const client3 = { write: jest.fn() } as any;

      notificationService.addClient(client1);
      notificationService.addClient(client2);
      notificationService.addClient(client3);

      // @ts-ignore
      expect(notificationService['clients']).toHaveLength(3);
    });
  });

  describe('removeClient', () => {
    it('debe remover un cliente de la lista', () => {
      notificationService.addClient(mockResponse as Response);
      notificationService.removeClient(mockResponse as Response);

      // @ts-ignore
      expect(notificationService['clients']).toHaveLength(0);
    });

    it('debe mantener otros clientes al remover uno', () => {
      const client1 = { write: jest.fn() } as any;
      const client2 = { write: jest.fn() } as any;

      notificationService.addClient(client1);
      notificationService.addClient(client2);
      notificationService.removeClient(client1);

      // @ts-ignore
      const clients = notificationService['clients'];
      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(client2);
    });
  });

  describe('handleOrderEvent', () => {
    beforeEach(() => {
      // Silenciar console.log en tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('debe procesar evento order.created y enviar notificación', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'ABC123',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      // Verificar que se llamó write (2 veces: bienvenida + notificación)
      expect(client.write).toHaveBeenCalledTimes(2);

      // Verificar el mensaje de notificación
      const notificationCall = client.write.mock.calls[1][0];
      expect(notificationCall).toContain('data:');
      expect(notificationCall).toContain('Pedido #ABC123 recibido correctamente');
      expect(notificationCall).toContain('"type":"info"');
    });

    it('debe procesar evento order.ready y enviar notificación', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'XYZ789',
        type: 'order.ready',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      const notificationCall = client.write.mock.calls[1][0];
      expect(notificationCall).toContain('¡Tu pedido #XYZ789 está listo para recoger!');
      expect(notificationCall).toContain('"type":"success"');
    });

    it('debe enviar notificación a múltiples clientes', () => {
      const client1 = { write: jest.fn() } as any;
      const client2 = { write: jest.fn() } as any;
      const client3 = { write: jest.fn() } as any;

      notificationService.addClient(client1);
      notificationService.addClient(client2);
      notificationService.addClient(client3);

      const event: OrderEvent = {
        orderId: 'TEST123',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      // Todos los clientes deben recibir la notificación
      expect(client1.write).toHaveBeenCalledTimes(2); // bienvenida + notificación
      expect(client2.write).toHaveBeenCalledTimes(2);
      expect(client3.write).toHaveBeenCalledTimes(2);
    });

    it('debe incluir orderId en la notificación', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'ORDER-456',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      const notificationCall = client.write.mock.calls[1][0];
      const data = JSON.parse(notificationCall.replace('data: ', '').trim());
      expect(data.orderId).toBe('ORDER-456');
    });

    it('debe incluir timestamp en la notificación', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'TEST',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      const notificationCall = client.write.mock.calls[1][0];
      const data = JSON.parse(notificationCall.replace('data: ', '').trim());
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Formato SSE', () => {
    it('debe enviar mensajes en formato SSE correcto', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'TEST',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      const message = client.write.mock.calls[1][0];
      
      // Formato SSE: debe empezar con "data:" y terminar con "\n\n"
      expect(message).toMatch(/^data: /);
      expect(message).toMatch(/\n\n$/);
    });

    it('debe enviar JSON válido en el campo data', () => {
      const client = { write: jest.fn() } as any;
      notificationService.addClient(client);

      const event: OrderEvent = {
        orderId: 'TEST',
        type: 'order.created',
        timestamp: new Date(),
      };

      notificationService.handleOrderEvent(event);

      const message = client.write.mock.calls[1][0];
      const jsonStr = message.replace('data: ', '').replace('\n\n', '');
      
      // No debe lanzar error al parsear
      expect(() => JSON.parse(jsonStr)).not.toThrow();
      
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('type');
      expect(parsed).toHaveProperty('message');
      expect(parsed).toHaveProperty('orderId');
      expect(parsed).toHaveProperty('timestamp');
    });
  });
});