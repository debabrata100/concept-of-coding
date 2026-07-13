const EventEmitter = require("events");

class OrderEventEmitter extends EventEmitter {}

const orderEventEmitter = new OrderEventEmitter();

function createOrder(id) {
  const order = {
    id,
    item: "Laptop",
    quantity: 1,
  };
  orderEventEmitter.emit("order-created", order);
}

const inventoryListener = (order) => {
  setTimeout(() => {
    console.log("Inventory updated for order:", order);
  }, 1000);
};

const paymentListener = (order) => {
  setTimeout(() => {
    console.log("Payment started for order:", order);
    throw new Error("Payment failed for order: " + order.id);
  }, 2000);
};

const notificationListener = (order) => {
  setTimeout(() => {
    console.log("Notification Sent for order:", order);
  }, 4000);
};

orderEventEmitter.on("order-created", inventoryListener);
orderEventEmitter.on("order-created", paymentListener);
orderEventEmitter.on("order-created", notificationListener);

orderEventEmitter.on("error", (err) => {
  console.error("Error event received:", err.message);
});

setImmediate(() => {
  createOrder(123);
  createOrder(234);
});
// createOrder(123);
// notificationListener removed after first order created event, so it will not be called for second order created event
orderEventEmitter.off("order-created", notificationListener);
// createOrder(234);
