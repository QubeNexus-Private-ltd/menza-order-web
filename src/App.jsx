import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Header from './components/Header';
import CustomerView from './components/CustomerView';
import StaffView from './components/StaffView';
import CartModal from './components/CartModal';
import OrderTrackerModal from './components/OrderTrackerModal';
import QrScannerModal from './components/QrScannerModal';
import * as api from './services/api';

export default function App() {
  const [mode, setMode] = useState('customer'); // 'customer' | 'staff'
  const [catalog, setCatalog] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({ items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
  const [activeTable, setActiveTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [staffUser, setStaffUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [orderTypes, setOrderTypes] = useState([]);

  // Modals visibility
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [orderTrackerOpen, setOrderTrackerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Loaders & Toast Banners
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // 1. Initial Load & URL Encrypted Parameter Check
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlTableId = searchParams.get('tableId');
    const encRestId = searchParams.get('encRestId') || searchParams.get('r') || searchParams.get('enc');
    const legacyRestId = searchParams.get('restaurantId');

    const initializeMenu = async () => {
      // Fetch dynamic order types from OrderTypeMaster API
      api.getOrderTypes().then((types) => {
        if (Array.isArray(types) && types.length > 0) {
          setOrderTypes(types);
        }
      });

      let targetEncryptedId = encRestId;
      if (!targetEncryptedId && legacyRestId) {
        // Scrub plain numeric ID and resolve to encrypted token
        const encResult = await api.getEncryptedRestaurantIdFromApi(Number(legacyRestId));
        targetEncryptedId = encResult.encryptedRestaurantId;
      }
      if (!targetEncryptedId) {
        // Default to encrypted ID for restaurant #1
        targetEncryptedId = 'uqQTzsGyDJy4_TBVeYXCfg';
      }

      const targetTableNum = urlTableId ? Number(urlTableId) : null;

      // Always synchronize browser address bar to ONLY expose encrypted ID
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.set('encRestId', targetEncryptedId);
        if (targetTableNum) cleanUrl.searchParams.set('tableId', targetTableNum);
        cleanUrl.searchParams.delete('restaurantId');
        cleanUrl.searchParams.delete('r');
        cleanUrl.searchParams.delete('enc');
        window.history.replaceState({}, '', cleanUrl);
      } catch (e) {}

      loadMenuViaEncryptedEndpoint(targetEncryptedId, targetTableNum);
    };

    initializeMenu();
  }, []);

  // Encrypted Menu Loading Function calling backend endpoint /api/MenuCatalog/encrypted/{encryptedRestaurantId}
  const loadMenuViaEncryptedEndpoint = async (encryptedRestId, targetTableId = null) => {
    setLoading(true);
    try {
      // Call backend API /api/MenuCatalog/encrypted/{encryptedRestaurantId}
      const catData = await api.getMenuCatalogByEncryptedId(encryptedRestId);
      setCatalog(catData);
      setCategories(catData.categories || []);
      setItems(catData.items || []);

      const numericRestId = catData.restaurantId || api.decryptRestaurantId(encryptedRestId);

      // Fetch tables specifically for this restaurant
      const tablesData = await api.getTables(numericRestId);
      setTables(tablesData || []);

      // Set Active Table Context
      if (targetTableId) {
        const found = tablesData.find((t) => t.id === targetTableId);
        if (found) {
          setActiveTable(found);
        } else {
          setActiveTable({ id: targetTableId, tableName: `Table #${targetTableId}`, rId: numericRestId });
        }
      } else if (tablesData.length > 0) {
        setActiveTable(tablesData[0]);
      } else {
        setActiveTable({ id: 1, tableName: 'Table #1', rId: numericRestId });
      }

      // Update Selected Restaurant State
      const rObj = (restaurants || []).find((r) => r.id === numericRestId) || {
        id: numericRestId,
        name: catData.restaurantName || `Restaurant #${numericRestId}`,
        encryptedRestaurantId: encryptedRestId
      };
      setSelectedRestaurant(rObj);

      // Fetch Cart & Orders
      const cartData = await api.getCart();
      setCart(cartData || { items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });

      const allOrd = await api.getAllOrders();
      setOrders(allOrd || []);

      showToast(`🔒 Encrypted Menu Loaded: ${rObj.name}`);
    } catch (err) {
      console.error('Failed to load encrypted menu catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  // Triggered whenever customer scans a restaurant QR code or selects a table
  const handleSelectScanResult = async (restaurantIdentifier, tableId) => {
    let encId = restaurantIdentifier;
    // If a numeric ID or number string was passed, resolve to authoritative encrypted ID
    if (typeof restaurantIdentifier === 'number' || (typeof restaurantIdentifier === 'string' && !isNaN(Number(restaurantIdentifier)))) {
      const encResult = await api.getEncryptedRestaurantIdFromApi(Number(restaurantIdentifier));
      encId = encResult.encryptedRestaurantId;
    }

    const numericRestId = api.decryptRestaurantId(encId);

    if (catalog && catalog.restaurantId !== numericRestId) {
      // Clear previous cart when switching to a different restaurant location
      await api.clearCart();
      setCart({ items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
    }

    // Sync URL in the browser address bar: STRICTLY ONLY encrypted ID!
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('encRestId', encId);
      if (tableId) url.searchParams.set('tableId', tableId);
      url.searchParams.delete('restaurantId');
      url.searchParams.delete('r');
      url.searchParams.delete('enc');
      window.history.pushState({}, '', url);
    } catch (e) {}

    await loadMenuViaEncryptedEndpoint(encId, tableId);
  };

  // Refresh data action
  const handleRefreshData = async () => {
    const encId = catalog ? catalog.encryptedRestaurantId || api.encryptRestaurantId(1) : api.encryptRestaurantId(1);
    await loadMenuViaEncryptedEndpoint(encId, activeTable ? activeTable.id : null);
    showToast('Encrypted menu refreshed');
  };

  // --- CART ACTIONS ---
  const handleAddToCart = async (itemId, quantity = 1, options = {}) => {
    const restId = catalog ? catalog.restaurantId : 1;
    const itemObj = (items || []).find((i) => i.itemId === itemId);
    await api.addToCart(restId, itemId, quantity, { ...options, item: itemObj });
    const updatedCart = await api.getCart();
    setCart(updatedCart || { items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
    showToast(`🛒 Added ${itemObj ? itemObj.itemName : 'dish'} to basket`);
  };

  const handleUpdateCartQuantity = async (itemId, quantity, options = {}) => {
    if (quantity <= 0) {
      await api.removeFromCart(itemId);
    } else {
      await api.updateCartQuantity(itemId, quantity, options);
    }
    const updatedCart = await api.getCart();
    setCart(updatedCart || { items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
  };

  const handleRemoveFromCart = async (itemId) => {
    await api.removeFromCart(itemId);
    const updatedCart = await api.getCart();
    setCart(updatedCart || { items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
    showToast('Item removed from cart');
  };

  const handleClearCart = async () => {
    await api.clearCart();
    setCart({ items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
    showToast('Cart cleared');
  };

  // --- ORDER ACTIONS ---
  const handlePlaceOrder = async (orderPayload) => {
    setLoading(true);
    try {
      const restId = (cart && cart.restaurantId) || (catalog ? catalog.restaurantId : 1);
      const result = await api.placeOrder({
        ...orderPayload,
        restaurantId: restId,
      });

      if (result && result.orderId) {
        const placed = await api.getOrder(result.orderId);
        setActiveOrder(placed);
        await api.clearCart();
        setCart({ items: [], totalAmount: 0, cgstAmount: 0, sgstAmount: 0, subTotal: 0, hasUnavailableItems: false });
        setCartModalOpen(false);
        setOrderTrackerOpen(true);
        showToast(`Order #${result.orderId} placed successfully!`);

        // Refresh orders list
        const allOrd = await api.getAllOrders();
        setOrders(allOrd);
      }
    } catch (err) {
      showToast('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open Cart: triggers API getCart to retrieve all fresh cart items
  const handleOpenCart = async () => {
    try {
      const freshCart = await api.getCart();
      if (freshCart) {
        setCart(freshCart);
      }
    } catch (e) {}
    setCartModalOpen(true);
  };

  // --- QUICK TABLE ACTIONS ---
  const handleCallWaiter = async () => {
    if (!activeTable) return;
    const res = await api.callWaiter(activeTable.id);
    showToast(res.message || 'Waiter has been notified to attend your table.');
  };

  const handleRequestBill = async () => {
    if (!activeTable) return;
    const res = await api.requestBill(activeTable.id);
    showToast(res.message || `Bill requested for Table #${activeTable.id}`);
  };

  // --- STAFF AUTH & POS ACTIONS ---
  const handleStaffLogin = async (mobile, otpCode) => {
    const res = await api.loginWithOtp(mobile, otpCode);
    if (res && res.token) {
      setStaffUser(res.user);
      setRestaurants(res.restaurants || []);
      if (res.restaurants && res.restaurants.length > 0) {
        setSelectedRestaurant(res.restaurants[0]);
      }
      showToast(`Welcome back, ${res.user.name}!`);
    }
  };

  const handleStaffLogout = () => {
    api.setAuthToken(null);
    setStaffUser(null);
    showToast('Logged out of staff POS');
  };

  const handleUpdateTableStatus = async (tableId, status) => {
    await api.updateTableStatus(tableId, status);
    const restId = selectedRestaurant ? selectedRestaurant.id : 1;
    const tList = await api.getTables(restId);
    setTables(tList);
    showToast(`Table #${tableId} status set to ${status}`);
  };

  const handleSettleTable = async (tableId) => {
    await api.settleTable(tableId);
    const restId = selectedRestaurant ? selectedRestaurant.id : 1;
    const tList = await api.getTables(restId);
    setTables(tList);
    const allOrd = await api.getAllOrders();
    setOrders(allOrd);
    showToast(`Table #${tableId} session closed & settled!`);
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    await api.updateOrderStatus(orderId, status);
    const allOrd = await api.getAllOrders();
    setOrders(allOrd);
    showToast(`Order #${orderId} status updated to ${status}`);
  };

  const handleUpdateKitchenStatus = async (orderId, status) => {
    await api.updateKitchenOrderStatus(orderId, status);
    const allOrd = await api.getAllOrders();
    setOrders(allOrd);
    showToast(`Kitchen Ticket #${orderId} marked Ready!`);
  };

  const handleAddItemsToOrder = async (orderIdOrPayload, itemId, quantity, amount) => {
    if (typeof orderIdOrPayload === 'object') {
      const restId = catalog ? catalog.restaurantId : 1;
      const result = await api.placeOrder({ ...orderIdOrPayload, restaurantId: restId });
      const allOrd = await api.getAllOrders();
      setOrders(allOrd);
      showToast(`Staff created Order #${result.orderId}`);
    } else {
      await api.addItemToOrder(orderIdOrPayload, itemId, quantity, amount);
      const allOrd = await api.getAllOrders();
      setOrders(allOrd);
      showToast(`Item added to Order #${orderIdOrPayload}`);
    }
  };

  return (
    <View style={styles.appContainer}>
      {/* Toast Notification Banner */}
      {toastMessage ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Top Header */}
      <Header
        mode={mode}
        setMode={setMode}
        activeTable={activeTable}
        openScanner={() => setScannerOpen(true)}
        cartCount={(cart?.items || []).reduce((acc, i) => acc + i.quantity, 0)}
        openCart={handleOpenCart}
        openOrderTracker={() => setOrderTrackerOpen(true)}
        activeOrder={activeOrder}
        onCallWaiter={handleCallWaiter}
        onRequestBill={handleRequestBill}
        staffUser={staffUser}
        openLogin={() => setMode('staff')}
        onLogout={handleStaffLogout}
        restaurantName={catalog ? catalog.restaurantName : 'Menza Fine Dining'}
      />

      {/* View Switcher: Customer Mode vs Staff Mode */}
      {mode === 'customer' ? (
        <CustomerView
          catalog={catalog}
          categories={categories}
          items={items}
          activeTable={activeTable}
          openScanner={() => setScannerOpen(true)}
          cartItems={cart?.items || []}
          openCart={handleOpenCart}
          onAddToCart={handleAddToCart}
          onUpdateCartQuantity={handleUpdateCartQuantity}
          onCallWaiter={handleCallWaiter}
          onRequestBill={handleRequestBill}
          loading={loading}
        />
      ) : (
        <StaffView
          staffUser={staffUser}
          restaurants={restaurants}
          selectedRestaurant={selectedRestaurant}
          catalog={catalog}
          onSelectRestaurant={async (rest) => {
            setSelectedRestaurant(rest);
            let encId = rest.encryptedRestaurantId;
            if (!encId) {
              const encRes = await api.getEncryptedRestaurantIdFromApi(rest.id);
              encId = encRes.encryptedRestaurantId;
            }
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('encRestId', encId);
              url.searchParams.delete('restaurantId');
              url.searchParams.delete('r');
              url.searchParams.delete('enc');
              window.history.pushState({}, '', url);
            } catch (e) {}
            loadMenuViaEncryptedEndpoint(encId);
          }}
          onGenerateOtp={api.generateOtp}
          onLogin={handleStaffLogin}
          tables={tables}
          orders={orders}
          items={items}
          onUpdateTableStatus={handleUpdateTableStatus}
          onSettleTable={handleSettleTable}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdateKitchenStatus={handleUpdateKitchenStatus}
          onAddItemToOrder={handleAddItemsToOrder}
          onRefreshData={handleRefreshData}
          onOpenQrGenerator={() => {}}
          orderTypes={orderTypes}
        />
      )}

      {/* Cart Modal */}
      <CartModal
        visible={cartModalOpen}
        onClose={() => setCartModalOpen(false)}
        cart={cart}
        cartItems={cart?.items || []}
        onUpdateCartQuantity={handleUpdateCartQuantity}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onPlaceOrder={handlePlaceOrder}
        onRefreshCart={handleOpenCart}
        activeTable={activeTable}
        catalog={catalog}
        orderTypes={orderTypes}
        loading={loading}
      />

      {/* Order Tracker Modal */}
      <OrderTrackerModal
        visible={orderTrackerOpen}
        onClose={() => setOrderTrackerOpen(false)}
        order={activeOrder}
      />

      {/* QR Scanner Modal */}
      <QrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSelectScanResult={handleSelectScanResult}
        activeEncryptedId={catalog ? catalog.encryptedRestaurantId : 'uqQTzsGyDJy4_TBVeYXCfg'}
        activeRestaurantId={catalog ? catalog.restaurantId : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0b0f19',
    position: 'relative',
  },
  toastBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    zIndex: 9999,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  toastText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
  },
});
