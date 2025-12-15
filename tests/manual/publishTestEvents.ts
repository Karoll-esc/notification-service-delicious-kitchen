/**
 * Script de prueba manual para RabbitMQ
 * Ejecutar con: npm run test:manual
 * 
 * Requiere RabbitMQ corriendo en localhost:5672
 */

import * as amqp from 'amqplib/callback_api';
import { OrderEvent } from '../../src/types';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const EXCHANGE = 'orders';

async function publishTestEvent(event: OrderEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    amqp.connect(RABBITMQ_URL, (err, conn) => {
      if (err) {
        reject(err);
        return;
      }

      conn.createChannel((err, ch) => {
        if (err) {
          reject(err);
          return;
        }

        ch.assertExchange(EXCHANGE, 'topic', { durable: true }, (err) => {
          if (err) {
            reject(err);
            return;
          }

          const message = JSON.stringify(event);
          const routingKey = event.type;

          ch.publish(EXCHANGE, routingKey, Buffer.from(message));
          console.log(`✅ Evento publicado: ${event.type} - Order #${event.orderId}`);

          setTimeout(() => {
            ch.close(() => {
              conn.close(() => {
                resolve();
              });
            });
          }, 500);
        });
      });
    });
  });
}

async function runTests() {
  console.log('🧪 Iniciando pruebas manuales de RabbitMQ...\n');

  try {
    // Test 1: order.created
    console.log('📨 Test 1: Publicando order.created');
    await publishTestEvent({
      orderId: 'TEST-001',
      type: 'order.created',
      timestamp: new Date(),
      data: { items: ['Pizza Margherita', 'Coca-Cola'] },
    });

    await sleep(2000);

    // Test 2: order.ready
    console.log('📨 Test 2: Publicando order.ready');
    await publishTestEvent({
      orderId: 'TEST-001',
      type: 'order.ready',
      timestamp: new Date(),
    });

    await sleep(2000);

    // Test 3: Múltiples eventos
    console.log('📨 Test 3: Publicando múltiples eventos');
    for (let i = 1; i <= 5; i++) {
      await publishTestEvent({
        orderId: `BATCH-${i}`,
        type: 'order.created',
        timestamp: new Date(),
      });
      await sleep(500);
    }

    console.log('\n✅ Todas las pruebas completadas');
    console.log('👀 Verifica que el Notification Service haya recibido los eventos');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ejecutar tests
runTests();