import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  View,
  StyleSheet,
  Text,
} from 'react-native';

import Header from './components/Header';
import CustomerView from './components/CustomerView';
import StaffView from './components/StaffView';
import CartModal from './components/CartModal';
import OrderTrackerModal from './components/OrderTrackerModal';
import QrScannerModal from './components/QrScannerModal';
import RestaurantQrModal from './components/RestaurantQrModal';

import * as api from './services/api';

export default function App() {
  const [mode, setMode] =
    useState('customer');

  const [catalog, setCatalog] =
    useState(null);

  const [categories, setCategories] =
    useState([]);

  const [items, setItems] =
    useState([]);

  const [tables, setTables] =
    useState([]);

  const [orders, setOrders] =
    useState([]);

  const [cart, setCart] = useState({
    userId: 0,
    deviceId: '',
    restaurantId: null,
    restaurantName: '',
    items: [],
    itemTotal: 0,
    subTotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    platformFee: 0,
    vendorPayoutAmount: 0,
    hasUnavailableItems: false,
  });

  const [cartItems, setCartItems] =
    useState([]);

  const [activeTable, setActiveTable] =
    useState(null);

  const [activeOrder, setActiveOrder] =
    useState(null);

  const [staffUser, setStaffUser] =
    useState(null);

  const [restaurants, setRestaurants] =
    useState([]);

  const [
    selectedRestaurant,
    setSelectedRestaurant,
  ] = useState(null);

  const [
    cartModalOpen,
    setCartModalOpen,
  ] = useState(false);

  const [
    orderTrackerOpen,
    setOrderTrackerOpen,
  ] = useState(false);

  const [
    scannerOpen,
    setScannerOpen,
  ] = useState(false);

  const [
    qrModalOpen,
    setQrModalOpen,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [toastMessage, setToastMessage] =
    useState('');

  const showToast = (msg) => {
    setToastMessage(msg);

    setTimeout(
      () => setToastMessage(''),
      4500
    );
  };

  /* =========================
     CART
  ========================= */

  const syncCart = (cartData) => {
    const safeCart =
      cartData || {
        userId: 0,
        deviceId: api.getDeviceId(),
        restaurantId: null,
        restaurantName: '',
        items: [],
        itemTotal: 0,
        subTotal: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        platformFee: 0,
        vendorPayoutAmount: 0,
        hasUnavailableItems: false,
      };

    setCart(safeCart);

    setCartItems(
      Array.isArray(safeCart.items)
        ? safeCart.items
        : []
    );

    return safeCart;
  };

  const refreshCart = async () => {
    const cartData =
      await api.getCart();

    return syncCart(cartData);
  };

  /* =========================
     MENU
  ========================= */

  useEffect(() => {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    const urlTableId =
      searchParams.get('tableId');

    const encRestId =
      searchParams.get('encRestId');

    const urlRestId =
      searchParams.get(
        'restaurantId'
      ) || 1;

    const paymentReturnOrderId =
      searchParams.get('order_id') ||
      searchParams.get('orderId') ||
      searchParams.get('cf_order_id');

    const initializeMenu =
      async () => {
        let targetEncryptedId =
          encRestId;

        if (!targetEncryptedId) {
          const encResult =
            await api.getEncryptedRestaurantIdFromApi(
              Number(urlRestId)
            );

          targetEncryptedId =
            encResult.encryptedRestaurantId;
        }

        const targetTableNum =
          urlTableId
            ? Number(urlTableId)
            : null;

        await loadMenuViaEncryptedEndpoint(
          targetEncryptedId,
          targetTableNum
        );

        if (paymentReturnOrderId) {
          try {
            let statusRes = null;
            try {
              statusRes = await api.getCashfreePaymentStatus(
                paymentReturnOrderId
              );
            } catch (statusErr) {
              console.log(
                'Cashfree status check:',
                statusErr?.message
              );
            }

            const ordersList =
              (await api.getMyOrders()) || [];

            let targetOrder =
              ordersList.find(
                (o) =>
                  String(o.cashfreeOrderId) ===
                    String(paymentReturnOrderId) ||
                  String(o.paymentOrderId) ===
                    String(paymentReturnOrderId) ||
                  String(o.id) ===
                    String(paymentReturnOrderId)
              );

            if (!targetOrder && ordersList.length > 0) {
              targetOrder = ordersList[0];
            }

            if (targetOrder) {
              // 1. Confirm payment and transition status via PublicDineInController endpoint
              let confirmedOrder = null;
              try {
                confirmedOrder = await api.confirmOrderPayment(
                  targetOrder.id,
                  paymentReturnOrderId
                );
              } catch (confErr) {
                console.log('Public confirmOrderPayment error:', confErr?.message);
              }

              // 2. Fetch full tracked order details via PublicDineInController
              let fullOrder = confirmedOrder;
              if (!fullOrder) {
                try {
                  fullOrder = await api.getOrder(targetOrder.id);
                } catch (ordErr) {
                  console.log('Fetch updated order error:', ordErr?.message);
                }
              }

              const finalOrder = {
                ...(fullOrder || targetOrder),
                items: (fullOrder?.items && fullOrder.items.length > 0)
                  ? fullOrder.items
                  : (targetOrder.items || []),
                paymentStatus: 'SUCCESS',
                orderStatus: 'Confirmed',
              };

              setActiveOrder(finalOrder);
              setOrderTrackerOpen(true);
              showToast(
                `🎉 Payment completed! Order #${finalOrder.id} is confirmed and sent to the kitchen.`
              );

              await api.clearCart();
              syncCart(null);

              if (
                typeof window !== 'undefined' &&
                window.history?.replaceState
              ) {
                const cleanUrl = new URL(
                  window.location.href
                );
                cleanUrl.searchParams.delete('order_id');
                cleanUrl.searchParams.delete('orderId');
                cleanUrl.searchParams.delete('cf_order_id');
                cleanUrl.searchParams.delete('payment_status');

                // If table ordering is disabled or order has no table, remove tableId from URL
                if (catData?.isTableOrderingEnabled === false || !targetOrder.tableId) {
                  cleanUrl.searchParams.delete('tableId');
                }

                window.history.replaceState(
                  {},
                  document.title,
                  cleanUrl.toString()
                );
              }
            }
          } catch (e) {
            console.error(
              'Post payment redirect handling error:',
              e
            );
          }
        }
      };

    initializeMenu();
  }, []);

  const loadMenuViaEncryptedEndpoint =
    async (
      encryptedRestId,
      targetTableId = null
    ) => {
      setLoading(true);

      try {
        const catData =
          await api.getMenuCatalogByEncryptedId(
            encryptedRestId
          );

        setCatalog(catData);
        setCategories(
          catData.categories || []
        );
        setItems(
          catData.items || []
        );

        const numericRestId =
          catData.restaurantId ||
          api.decryptRestaurantId(
            encryptedRestId
          );

        const tablesData =
          await api.getTables(
            numericRestId
          );

        setTables(
          tablesData || []
        );

        if (targetTableId) {
          const found =
            tablesData.find(
              (t) =>
                t.id ===
                targetTableId
            );

          if (found) {
            setActiveTable(found);
          } else {
            setActiveTable({
              id: targetTableId,
              tableName:
                `Table #${targetTableId}`,
              rId: numericRestId,
            });
          }
        } else if (
          tablesData.length > 0
        ) {
          setActiveTable(
            tablesData[0]
          );
        } else {
          setActiveTable({
            id: 1,
            tableName: 'Table #1',
            rId: numericRestId,
          });
        }

        const rObj =
          (
            restaurants || []
          ).find(
            (r) =>
              r.id === numericRestId
          ) || {
            id: numericRestId,
            name:
              catData.restaurantName ||
              `Restaurant #${numericRestId}`,
          };

        setSelectedRestaurant(
          rObj
        );

        await refreshCart();

        const allOrd =
          await api.getAllOrders();

        setOrders(
          allOrd || []
        );
      } catch (err) {
        console.error(
          'Failed to load menu:',
          err
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     QR
  ========================= */

  const handleSelectScanResult =
    async (
      restaurantId,
      tableId
    ) => {
      const encResult =
        await api.getEncryptedRestaurantIdFromApi(
          restaurantId
        );

      const encId =
        encResult.encryptedRestaurantId;

      if (
        catalog &&
        Number(
          catalog.restaurantId
        ) !==
          Number(restaurantId)
      ) {
        await api.clearCart();
        syncCart(null);
      }

      try {
        const url =
          new URL(
            window.location.href
          );

        url.searchParams.set(
          'restaurantId',
          restaurantId
        );

        if (tableId) {
          url.searchParams.set(
            'tableId',
            tableId
          );
        }

        url.searchParams.delete(
          'encRestId'
        );

        window.history.pushState(
          {},
          '',
          url
        );
      } catch (e) {}

      await loadMenuViaEncryptedEndpoint(
        encId,
        tableId
      );
    };

  /* =========================
     REFRESH
  ========================= */

  const handleRefreshData =
    async () => {
      const encId = catalog
        ? catalog.encryptedRestaurantId ||
          api.encryptRestaurantId(1)
        : api.encryptRestaurantId(1);

      await loadMenuViaEncryptedEndpoint(
        encId,
        activeTable
          ? activeTable.id
          : null
      );

      showToast(
        'Menu refreshed'
      );
    };

  /* =========================
     CART ACTIONS
  ========================= */

  const handleAddToCart =
    async (
      itemId,
      quantity = 1,
      itemData = null
    ) => {
      const restId =
        catalog
          ? catalog.restaurantId
          : 1;

      const itemObj =
        itemData ||
        (items || []).find(
          (i) =>
            Number(i.itemId) ===
            Number(itemId)
        ) ||
        null;

      await api.addToCart(
        restId,
        itemId,
        quantity,
        { item: itemObj }
      );

      await refreshCart();

      showToast(
        'Added dish to cart'
      );
    };

  const handleUpdateCartQuantity =
    async (
      itemId,
      quantity,
      cookingInstruction = null
    ) => {
      await api.updateCartQuantity(
        itemId,
        quantity,
        cookingInstruction
      );

      await refreshCart();
    };

  const handleRemoveFromCart =
    async (itemId) => {
      await api.removeFromCart(
        itemId
      );

      await refreshCart();
    };

  const handleClearCart =
    async () => {
      await api.clearCart();

      syncCart(null);

      showToast(
        'Cart cleared'
      );
    };

  /* =========================
     ORDER
  ========================= */

  const handlePlaceOrder =
    async (orderPayload) => {
      setLoading(true);

      try {
        const restId =
          catalog
            ? catalog.restaurantId
            : 1;

        /*
         * IMPORTANT:
         * Make sure items are always
         * attached to the order.
         */
        const payload = {
          ...orderPayload,

          restaurantId:
            restId,

          tableId:
            orderPayload.tableId ||
            (
              activeTable
                ? activeTable.id
                : null
            ),

          deviceId:
            orderPayload.deviceId ||
            api.getDeviceId(),

          items:
            Array.isArray(
              orderPayload.items
            ) &&
            orderPayload.items.length
              ? orderPayload.items
              : cartItems.map(
                  (item) => ({
                    itemId:
                      item.itemId,

                    itemName:
                      item.itemName,

                    quantity:
                      Number(
                        item.quantity ||
                          1
                      ),

                    amount:
                      Number(
                        item.unitPrice ??
                          item.amount ??
                          item.price ??
                          0
                      ),

                    unitPrice:
                      Number(
                        item.unitPrice ??
                          item.amount ??
                          item.price ??
                          0
                      ),

                    totalAmount:
                      Number(
                        item.totalAmount ??
                          (
                            item.unitPrice ??
                            item.amount ??
                            item.price ??
                            0
                          ) *
                            Number(
                              item.quantity ||
                                1
                            )
                      ),

                    cookingInstruction:
                      item.cookingInstruction ||
                      null,
                  })
                ),

          subTotal:
            Number(
              orderPayload.subTotal ??
                cart.subTotal ??
                cart.itemTotal ??
                0
            ),

          cgstAmount:
            Number(
              orderPayload.cgstAmount ??
                cart.cgstAmount ??
                0
            ),

          sgstAmount:
            Number(
              orderPayload.sgstAmount ??
                cart.sgstAmount ??
                0
            ),

          totalAmount:
            Number(
              orderPayload.totalAmount ??
                cart.totalAmount ??
                0
            ),
        };

        console.log(
          'FINAL ORDER PAYLOAD:',
          JSON.stringify(
            payload,
            null,
            2
          )
        );

        /*
         * CREATE ORDER FIRST
         */
        const result =
          await api.placeOrder(
            payload
          );

        if (
          !result ||
          !result.orderId
        ) {
          throw new Error(
            'Order ID was not returned'
          );
        }

        /*
         * GET COMPLETE ORDER
         */
        const placed =
          result.order ||
          (await api.getOrder(
            result.orderId
          ));

        if (!placed) {
          throw new Error(
            'Created order could not be loaded'
          );
        }

        /*
         * VERY IMPORTANT:
         * Keep complete order in state.
         */
        setActiveOrder({
          ...placed,

          items:
            Array.isArray(
              placed.items
            )
              ? placed.items
              : payload.items,

          subTotal:
            Number(
              placed.subTotal ??
                payload.subTotal
            ),

          cgstAmount:
            Number(
              placed.cgstAmount ??
                payload.cgstAmount
            ),

          sgstAmount:
            Number(
              placed.sgstAmount ??
                payload.sgstAmount
            ),

          totalAmount:
            Number(
              placed.totalAmount ??
                payload.totalAmount
            ),

          paymentStatus:
            placed.paymentStatus ||
            'Pending',
        });

        /*
         * Update order list
         */
        const allOrd =
          await api.getAllOrders();

        setOrders(
          allOrd || []
        );

        /*
         * Clear cart
         */
        await api.clearCart();

        syncCart(null);

        /*
         * Close cart and
         * open tracker.
         */
        setCartModalOpen(false);
        setOrderTrackerOpen(true);

        showToast(
          `Order #${result.orderId} created successfully!`
        );

        return result;
      } catch (err) {
        console.error(
          'PLACE ORDER ERROR:',
          err
        );

        showToast(
          'Failed to create order.'
        );

        throw err;
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     TABLE
  ========================= */

  const handleCallWaiter =
    async () => {
      if (!activeTable) return;

      const res =
        await api.callWaiter(
          activeTable.id
        );

      showToast(
        res.message ||
          'Waiter has been notified.'
      );
    };

  const handleRequestBill =
    async () => {
      if (!activeTable) return;

      const res =
        await api.requestBill(
          activeTable.id
        );

      showToast(
        res.message ||
          'Bill requested.'
      );
    };

  /* =========================
     LIVE ORDER TRACKING
  ========================= */

  const handleRefreshOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;

      const restId = Number(catalog?.restaurantId) || 1;

      try {
        const latest = await api.getLiveOrderTracking(orderId, restId);
        if (latest) {
          setActiveOrder((previous) => ({
            ...(previous || {}),
            ...latest,
          }));
          return latest;
        }
      } catch (error) {
        console.log('handleRefreshOrder error:', error?.message);
      }

      return null;
    },
    [catalog?.restaurantId]
  );

  /* =========================
     STAFF AUTH
  ========================= */

  const handleStaffLogin =
    async (
      mobile,
      otpCode
    ) => {
      const res =
        await api.loginWithOtp(
          mobile,
          otpCode
        );

      if (res && res.token) {
        setStaffUser(
          res.user
        );

        setRestaurants(
          res.restaurants || []
        );

        if (
          res.restaurants &&
          res.restaurants.length
        ) {
          setSelectedRestaurant(
            res.restaurants[0]
          );
        }

        showToast(
          `Welcome back, ${
            res.user?.name ||
            'Staff'
          }!`
        );
      }
    };

  const handleStaffLogout =
    () => {
      api.setAuthToken(null);
      setStaffUser(null);

      showToast(
        'Logged out of staff POS'
      );
    };

  /* =========================
     STAFF TABLES / ORDERS
  ========================= */

  const handleUpdateTableStatus =
    async (
      tableId,
      status
    ) => {
      await api.updateTableStatus(
        tableId,
        status
      );

      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : 1;

      const tList =
        await api.getTables(
          restId
        );

      setTables(tList);

      showToast(
        `Table #${tableId} status set to ${status}`
      );
    };

  const handleSettleTable =
    async (tableId) => {
      await api.settleTable(
        tableId
      );

      const restId =
        selectedRestaurant
          ? selectedRestaurant.id
          : 1;

      const tList =
        await api.getTables(
          restId
        );

      setTables(tList);

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      showToast(
        `Table #${tableId} settled!`
      );
    };

  const handleUpdateOrderStatus =
    async (
      orderId,
      status
    ) => {
      await api.updateOrderStatus(
        orderId,
        status
      );

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      /*
       * If customer is watching
       * same order, update tracker.
       */
      if (
        activeOrder &&
        Number(
          activeOrder.id
        ) === Number(orderId)
      ) {
        setActiveOrder(
          (prev) => ({
            ...prev,
            orderStatus:
              status,
          })
        );
      }

      showToast(
        `Order #${orderId} updated`
      );
    };

  const handleUpdateKitchenStatus =
    async (
      orderId,
      status
    ) => {
      await api.updateKitchenOrderStatus(
        orderId,
        status
      );

      const allOrd =
        await api.getAllOrders();

      setOrders(allOrd);

      if (
        activeOrder &&
        Number(
          activeOrder.id
        ) === Number(orderId)
      ) {
        setActiveOrder(
          (prev) => ({
            ...prev,
            orderStatus:
              status,
          })
        );
      }

      showToast(
        `Kitchen order #${orderId} updated`
      );
    };

  const handleAddItemsToOrder =
    async (
      orderIdOrPayload,
      itemId,
      quantity,
      amount
    ) => {
      if (
        typeof orderIdOrPayload ===
        'object'
      ) {
        const restId =
          catalog
            ? catalog.restaurantId
            : 1;

        const result =
          await api.placeOrder({
            ...orderIdOrPayload,
            restaurantId:
              restId,
          });

        const allOrd =
          await api.getAllOrders();

        setOrders(allOrd);

        showToast(
          `Staff created Order #${result.orderId}`
        );
      } else {
        await api.addItemToOrder(
          orderIdOrPayload,
          itemId,
          quantity,
          amount
        );

        const allOrd =
          await api.getAllOrders();

        setOrders(allOrd);

        showToast(
          `Item added to Order #${orderIdOrPayload}`
        );
      }
    };

  /* =========================
     UI
  ========================= */

  return (
    <View
      style={styles.appContainer}
    >
      {toastMessage ? (
        <View
          style={styles.toastBanner}
        >
          <Text
            style={styles.toastText}
          >
            {toastMessage}
          </Text>
        </View>
      ) : null}

      <Header
        mode={mode}
        setMode={setMode}
        activeTable={activeTable}
        openScanner={() =>
          setScannerOpen(true)
        }
        openQrModal={() =>
          setQrModalOpen(true)
        }
        cartCount={cartItems.reduce(
          (acc, item) =>
            acc +
            Number(
              item.quantity || 0
            ),
          0
        )}
        openCart={() =>
          setCartModalOpen(true)
        }
        openOrderTracker={() =>
          activeOrder
            ? setOrderTrackerOpen(
                true
              )
            : showToast(
                'No active order found.'
              )
        }
        activeOrder={activeOrder}
        onCallWaiter={
          handleCallWaiter
        }
        onRequestBill={
          handleRequestBill
        }
        staffUser={staffUser}
        openLogin={() =>
          setMode('staff')
        }
        onLogout={
          handleStaffLogout
        }
        restaurantName={
          catalog
            ? catalog.restaurantName
            : 'Menza Fine Dining'
        }
      />

      {mode === 'customer' ? (
        <CustomerView
          catalog={catalog}
          categories={categories}
          items={items}
          activeTable={activeTable}
          openScanner={() =>
            setScannerOpen(true)
          }
          openQrModal={() =>
            setQrModalOpen(true)
          }
          cartItems={cartItems}
          openCart={() =>
            setCartModalOpen(true)
          }
          onAddToCart={
            handleAddToCart
          }
          onUpdateCartQuantity={
            handleUpdateCartQuantity
          }
          onCallWaiter={
            handleCallWaiter
          }
          onRequestBill={
            handleRequestBill
          }
          loading={loading}
        />
      ) : (
        <StaffView
          staffUser={staffUser}
          restaurants={restaurants}
          selectedRestaurant={
            selectedRestaurant
          }
          onSelectRestaurant={(
            rest
          ) => {
            setSelectedRestaurant(
              rest
            );

            const encId =
              api.encryptRestaurantId(
                rest.id
              );

            loadMenuViaEncryptedEndpoint(
              encId
            );
          }}
          onGenerateOtp={
            api.generateOtp
          }
          onLogin={
            handleStaffLogin
          }
          tables={tables}
          orders={orders}
          items={items}
          onUpdateTableStatus={
            handleUpdateTableStatus
          }
          onSettleTable={
            handleSettleTable
          }
          onUpdateOrderStatus={
            handleUpdateOrderStatus
          }
          onUpdateKitchenStatus={
            handleUpdateKitchenStatus
          }
          onAddItemToOrder={
            handleAddItemsToOrder
          }
          onRefreshData={
            handleRefreshData
          }
          onOpenQrGenerator={() =>
            setQrModalOpen(true)
          }
        />
      )}

      <CartModal
        visible={cartModalOpen}
        onClose={() =>
          setCartModalOpen(false)
        }
        cart={cart}
        cartItems={cartItems}
        onUpdateCartQuantity={
          handleUpdateCartQuantity
        }
        onRemoveFromCart={
          handleRemoveFromCart
        }
        onClearCart={
          handleClearCart
        }
        onRefreshCart={
          refreshCart
        }
        onPlaceOrder={
          handlePlaceOrder
        }
        activeTable={activeTable}
        catalog={catalog}
        loading={loading}
      />

      <OrderTrackerModal
        visible={
          orderTrackerOpen
        }
        onClose={() =>
          setOrderTrackerOpen(
            false
          )
        }
        order={activeOrder}
        onRefreshOrder={handleRefreshOrder}
      />

      <QrScannerModal
        visible={scannerOpen}
        onClose={() =>
          setScannerOpen(false)
        }
        onSelectScanResult={
          handleSelectScanResult
        }
        activeRestaurantId={
          catalog
            ? catalog.restaurantId
            : 1
        }
      />

      <RestaurantQrModal
        visible={qrModalOpen}
        onClose={() =>
          setQrModalOpen(false)
        }
        catalog={catalog}
        restaurantName={
          catalog
            ? catalog.restaurantName
            : 'Menza Fine Dining'
        }
        activeTable={activeTable}
        tables={tables}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    position: 'relative',
  },

  toastBanner: {
    position: 'absolute',
    top: 65,
    alignSelf: 'center',
    maxWidth: '90%',
    zIndex: 9999,
    backgroundColor: '#78350f',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: '#78350f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  toastText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
});