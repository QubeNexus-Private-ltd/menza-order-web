import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import {
  Search,
  Plus,
  Minus,
  Store,
  ChevronUp,
} from 'lucide-react';

import {
  getUnitDescription,
  getItemImageUrl,
  IMAGE_NOT_AVAILABLE,
} from '../services/api';


/* =========================================================
   ITEM IMAGE

   Displays the REAL image coming from API.

   No new API call.
========================================================= */

function ItemImageWithFallback({
  uri,
  style,
  resizeMode = 'cover',
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const hasValidUri =
    typeof uri === 'string' &&
    uri.trim() !== '' &&
    uri.trim() !== IMAGE_NOT_AVAILABLE;

  if (!hasValidUri || hasError) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Store
          size={28}
          color="#B8B8B8"
        />

        <Text style={styles.imagePlaceholderText}>
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{
        uri: uri.trim(),
      }}
      style={style}
      resizeMode={resizeMode}
      onLoad={() => {
        console.log(
          'ITEM IMAGE LOADED:',
          uri
        );
      }}
      onError={(error) => {
        console.log(
          'ITEM IMAGE ERROR:',
          uri,
          error?.nativeEvent
        );

        setHasError(true);
      }}
    />
  );
}


/* =========================================================
   CUSTOMER VIEW
========================================================= */

export default function CustomerView({
  catalog,
  categories,
  items,
  activeTable,

  /*
   * Kept for compatibility with existing App.jsx.
   */
  openScanner,

  cartItems = [],
  openCart,
  onAddToCart,
  onUpdateCartQuantity,

  onCallWaiter,
  onRequestBill,

  loading,
}) {

  /* =======================================================
     FILTER STATES
  ======================================================= */

  const [selectedCategory, setSelectedCategory] =
    useState(null);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [vegOnly, setVegOnly] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState({});


  /* =======================================================
     RESTAURANT NAME
  ======================================================= */

  const restaurantName =
    catalog
      ? catalog.restaurantName ||
        `Restaurant #${catalog.restaurantId}`
      : 'Saffron Café';


  /* =======================================================
     CART TOTAL
  ======================================================= */

  const totalCartCount =
    (cartItems || []).reduce(
      (acc, item) =>
        acc + (Number(item.quantity) || 1),
      0
    );


  const totalCartAmount =
    (cartItems || []).reduce(
      (acc, item) =>
        acc +
        (
          Number(
            item.unitPrice ??
            item.amount ??
            0
          ) || 0
        ) *
        (Number(item.quantity) || 1),
      0
    );


  /* =======================================================
     FILTER ITEMS
  ======================================================= */

  const filteredItems =
    (items || []).filter(
      (item) => {

        if (
          selectedCategory &&
          item.categoryId !==
            selectedCategory
        ) {
          return false;
        }


        if (
          vegOnly &&
          !item.isVeg
        ) {
          return false;
        }


        if (
          searchQuery.trim()
        ) {

          const q =
            searchQuery
              .toLowerCase()
              .trim();


          const matchName =
            item.itemName &&
            String(item.itemName)
              .toLowerCase()
              .includes(q);


          const matchDesc =
            item.description &&
            String(item.description)
              .toLowerCase()
              .includes(q);


          if (
            !matchName &&
            !matchDesc
          ) {
            return false;
          }
        }


        return true;
      }
    );


  /* =======================================================
     CART HELPERS
  ======================================================= */

  const getCartItem =
    (itemId) => {

      return (
        (cartItems || []).find(
          (cartItem) =>
            cartItem.itemId === itemId
        ) || null
      );

    };


  const getCartQuantity =
    (itemId) => {

      const found =
        getCartItem(itemId);

      return found
        ? Number(
            found.quantity || 0
          )
        : 0;
    };


  /* =======================================================
     SUBTITLE / UNIT TAG
  ======================================================= */

  const getSubtitleTag =
    (
      item,
      cartItem
    ) => {

      const variantName =
        item?.variantName ||
        cartItem?.variantName ||
        item?.sizeName ||
        item?.size ||
        '';


      if (variantName) {
        return String(
          variantName
        ).trim();
      }


      const unitDesc =
        getUnitDescription(
          cartItem || item
        );


      if (
        unitDesc &&
        !unitDesc
          .toLowerCase()
          .includes('unit')
      ) {
        return unitDesc;
      }


      if (item?.categoryName) {

        const cat =
          String(item.categoryName)
            .toLowerCase();


        if (
          cat.includes('chai') ||
          cat.includes('coffee') ||
          cat.includes('beverage')
        ) {
          return 'Hot';
        }


        if (
          cat.includes('snack')
        ) {
          return 'Spicy';
        }


        if (
          cat.includes('sweet') ||
          cat.includes('dessert')
        ) {
          return 'Sweet';
        }


        if (
          cat.includes('breakfast')
        ) {
          return 'Breakfast';
        }


        return item.categoryName;
      }


      return item?.isVeg
        ? 'Veg'
        : 'Non-Veg';
    };


  /* =======================================================
     PRICE
  ======================================================= */

  const getUnitPrice =
    (
      item,
      cartItem
    ) => {

      const value =
        cartItem?.unitPrice ??
        cartItem?.amount ??
        item?.unitPrice ??
        item?.price ??
        0;


      const number =
        Number(value);


      return Number.isFinite(
        number
      )
        ? number
        : 0;
    };


  /* =======================================================
     ITEM ACTION
  ======================================================= */

  const runItemAction =
    async (
      itemId,
      action
    ) => {

      if (
        actionLoading[itemId]
      ) {
        return;
      }


      setActionLoading(
        (prev) => ({
          ...prev,
          [itemId]: true,
        })
      );


      try {

        await action();

      } catch (error) {

        console.error(
          'Customer item action failed:',
          error
        );

      } finally {

        setActionLoading(
          (prev) => {

            const next = {
              ...prev,
            };

            delete next[itemId];

            return next;
          }
        );
      }
    };


  /* =======================================================
     REAL API IMAGE

     ONLY IMAGE LOGIC

     The item itself is used as the source.
     No additional API request is made.
========================================================= */

  /*
   * Resolve the same real image value that the API/cart provides.
   *
   * IMPORTANT:
   * - No image URL is invented here.
   * - No image API request is made per card.
   * - Complete URLs are used exactly as returned by the API.
   * - Relative Azure/blob paths go through the existing API helper.
   * - When an item is already in the server cart, its imageUrl is also
   *   accepted as the authoritative API value.
   */
  const getDisplayImage =
    (item, cartItem = null) => {

      if (!item && !cartItem) {
        return '';
      }

      const imageCandidates = [
        item?.imageUrl,
        item?.ImageUrl,
        item?.ImageURL,
        item?.imageURL,
        item?.imagePath,
        item?.ImagePath,
        item?.photoUrl,
        item?.PhotoUrl,
        item?.photoURL,
        item?.PhotoURL,
        item?.img,
        item?.itemImage,
        item?.itemImageUrl,
        item?.ItemImage,
        item?.ItemImageUrl,
        item?.itemImageURL,
        item?.ItemImageURL,
        item?.imageFile,
        item?.ImageFile,
        item?.imageName,
        item?.ImageName,

        /*
         * Cart API image. This is especially useful when the same
         * item has already been loaded by GET /api/Cart.
         */
        cartItem?.imageUrl,
        cartItem?.ImageUrl,
        cartItem?.ImageURL,
        cartItem?.imageURL,
        cartItem?.imagePath,
        cartItem?.ImagePath,
        cartItem?.photoUrl,
        cartItem?.PhotoUrl,
        cartItem?.photoURL,
        cartItem?.PhotoURL,
        cartItem?.img,
        cartItem?.itemImage,
        cartItem?.itemImageUrl,
        cartItem?.ItemImage,
        cartItem?.ItemImageUrl,
      ];

      const apiImage =
        imageCandidates.find(
          (value) =>
            typeof value === 'string' &&
            value.trim() !== '' &&
            value.trim() !== IMAGE_NOT_AVAILABLE
        ) || '';

      if (!apiImage) {
        console.log(
          'NO REAL API IMAGE FOR ITEM:',
          item?.itemName,
          'itemId:',
          item?.itemId
        );

        return '';
      }

      const cleanImage = apiImage.trim();

      /*
       * The API can already return a complete URL.
       * Never rebuild or replace it.
       */
      if (
        cleanImage.startsWith('http://') ||
        cleanImage.startsWith('https://') ||
        cleanImage.startsWith('data:')
      ) {
        return cleanImage;
      }

      /*
       * The API can also return an Azure/blob relative path.
       * Use the existing service helper so the exact project
       * image-storage configuration remains in one place.
       */
      const generatedUrl =
        getItemImageUrl(
          cleanImage,
          item?.isVeg !== false
        );

      console.log(
        'ITEM API IMAGE:',
        item?.itemName,
        cleanImage,
        '=>',
        generatedUrl
      );

      return generatedUrl;
    };


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <View
      style={styles.rootWrapper}
    >

      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.contentContainer
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* =================================================
            CATEGORY FILTER
        ================================================== */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={
            styles.categoriesScroll
          }
          contentContainerStyle={
            styles.categoriesContainer
          }
        >

          <TouchableOpacity
            style={[
              styles.categoryChip,

              selectedCategory ===
                null &&
                styles.categoryChipActive,
            ]}
            onPress={() =>
              setSelectedCategory(
                null
              )
            }
            activeOpacity={0.85}
          >

            <Text
              style={[
                styles.categoryChipText,

                selectedCategory ===
                  null &&
                  styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>

          </TouchableOpacity>


          {(
            categories || []
          ).map(
            (cat) => (

              <TouchableOpacity
                key={
                  cat.categoryId
                }
                style={[
                  styles.categoryChip,

                  selectedCategory ===
                    cat.categoryId &&
                    styles.categoryChipActive,
                ]}
                onPress={() =>
                  setSelectedCategory(
                    cat.categoryId
                  )
                }
                activeOpacity={0.85}
              >

                <Text
                  style={[
                    styles.categoryChipText,

                    selectedCategory ===
                      cat.categoryId &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {
                    cat.categoryName
                  }
                </Text>

              </TouchableOpacity>

            )
          )}

        </ScrollView>


        {/* =================================================
            SEARCH + VEG
        ================================================== */}

        <View
          style={
            styles.controlsRow
          }
        >

          <View
            style={
              styles.searchBox
            }
          >

            <Search
              size={16}
              color="#747878"
            />

            <TextInput
              style={
                styles.searchInput
              }
              placeholder={
                `Search dishes in ${restaurantName}...`
              }
              placeholderTextColor="#9ca3af"
              value={
                searchQuery
              }
              onChangeText={
                setSearchQuery
              }
            />

          </View>


          <TouchableOpacity
            style={[
              styles.vegToggle,

              vegOnly &&
                styles.vegToggleActive,
            ]}
            onPress={() =>
              setVegOnly(
                !vegOnly
              )
            }
            activeOpacity={0.85}
          >

            <View
              style={[
                styles.vegDot,
                {
                  backgroundColor:
                    '#15803d',
                },
              ]}
            />

            <Text
              style={[
                styles.vegText,

                vegOnly &&
                  styles.vegTextActive,
              ]}
            >
              Veg
            </Text>

          </TouchableOpacity>

        </View>


        {/* =================================================
            SECTION HEADER
        ================================================== */}

        <View
          style={
            styles.sectionHeaderRow
          }
        >

          <Text
            style={
              styles.sectionHeaderTitle
            }
          >
            {
              selectedCategory
                ? 'Menu Selection'
                : 'Popular Choice'
            }
          </Text>


          <Text
            style={
              styles.itemCountBadge
            }
          >
            {
              filteredItems.length
            }{' '}
            {
              filteredItems.length ===
              1
                ? 'item'
                : 'items'
            }
          </Text>

        </View>


        {/* =================================================
            LOADING
        ================================================== */}

        {loading ? (

          <View
            style={
              styles.loaderBox
            }
          >

            <ActivityIndicator
              size="large"
              color="#D33401"
            />

            <Text
              style={
                styles.loaderText
              }
            >
              Loading culinary catalog
              for {restaurantName}...
            </Text>

          </View>

        ) : filteredItems.length ===
          0 ? (

          <View
            style={
              styles.emptyBox
            }
          >

            <Text
              style={
                styles.emptyTitle
              }
            >
              No Items Found
            </Text>

            <Text
              style={
                styles.emptySub
              }
            >
              No dishes match your
              filter in {restaurantName}.
            </Text>

          </View>

        ) : (

          /* =================================================
             ITEM GRID
          ================================================== */

          <View
            style={
              styles.grid
            }
          >

            {filteredItems.map(
              (item) => {

                const cartItem =
                  getCartItem(
                    item.itemId
                  );


                const qty =
                  getCartQuantity(
                    item.itemId
                  );


                const unitPrice =
                  getUnitPrice(
                    item,
                    cartItem
                  );


                const tag =
                  getSubtitleTag(
                    item,
                    cartItem
                  );


                const itemBusy =
                  !!actionLoading[
                    item.itemId
                  ];


                /*
                 * REAL API IMAGE
                 */

                const imageUrl =
                  getDisplayImage(
                    item,
                    cartItem
                  );


                return (

                  <View
                    key={
                      item.itemId
                    }
                    style={
                      styles.card
                    }
                  >

                    <TouchableOpacity
                      style={
                        styles.cardTouchable
                      }
                      activeOpacity={0.75}
                      onPress={() => {

                        if (
                          item.isAvailable &&
                          qty === 0
                        ) {

                          runItemAction(
                            item.itemId,

                            () =>
                              onAddToCart(
                                item.itemId,
                                1,
                                item
                              )
                          );

                        }

                      }}
                    >

                      {/* =================================
                          REAL API ITEM PHOTO
                      ================================== */}

                      <ItemImageWithFallback
                        uri={imageUrl}
                        style={
                          styles.itemImage
                        }
                        resizeMode="cover"
                      />


                      {/* =================================
                          VEG / TAG / RATING
                      ================================== */}

                      <View
                        style={
                          styles.cardHeaderRow
                        }
                      >

                        <View
                          style={[
                            styles.dietBadge,

                            item.isVeg
                              ? styles.vegBadgeBorder
                              : styles.nonVegBadgeBorder,
                          ]}
                        >

                          <View
                            style={[
                              styles.dietDot,
                              {
                                backgroundColor:
                                  item.isVeg
                                    ? '#15803d'
                                    : '#dc2626',
                              },
                            ]}
                          />

                        </View>


                        <Text
                          style={
                            styles.itemTag
                          }
                          numberOfLines={1}
                        >
                          {tag}
                        </Text>


                        <View
                          style={
                            styles.ratingPill
                          }
                        >

                          <Text
                            style={
                              styles.ratingText
                            }
                          >
                            ★ 4.9
                          </Text>

                        </View>

                      </View>


                      {/* =================================
                          ITEM NAME + DESCRIPTION
                      ================================== */}

                      <View
                        style={
                          styles.cardBody
                        }
                      >

                        <Text
                          style={
                            styles.itemName
                          }
                          numberOfLines={2}
                        >
                          {
                            item.itemName
                          }
                        </Text>


                        {item.description ? (

                          <Text
                            style={
                              styles.itemDesc
                            }
                            numberOfLines={2}
                          >
                            {
                              item.description
                            }
                          </Text>

                        ) : null}

                      </View>


                      {/* =================================
                          PRICE + CART BUTTON
                      ================================== */}

                      <View
                        style={
                          styles.cardBottomRow
                        }
                      >

                        <View
                          style={
                            styles.priceContainer
                          }
                        >

                          <Text
                            style={
                              styles.priceCurrency
                            }
                          >
                            INR
                          </Text>

                          <Text
                            style={
                              styles.itemPrice
                            }
                          >
                            ₹
                            {
                              Math.round(
                                unitPrice
                              ) ===
                              unitPrice
                                ? unitPrice
                                : unitPrice.toFixed(
                                    0
                                  )
                            }
                          </Text>

                        </View>


                        {/* =================================
                            SOLD OUT
                        ================================== */}

                        {!item.isAvailable ? (

                          <View
                            style={
                              styles.soldOutBadge
                            }
                          >

                            <Text
                              style={
                                styles.soldOutText
                            }
                            >
                              Sold Out
                            </Text>

                          </View>

                        ) : qty > 0 ? (

                          /* =================================
                             QUANTITY CONTROL
                          ================================== */

                          <View
                            style={
                              styles.qtyControlRow
                            }
                          >

                            <TouchableOpacity
                              style={[
                                styles.qtyActionBtn,

                                itemBusy &&
                                  styles.qtyBtnBusy,
                              ]}
                              onPress={() =>
                                runItemAction(
                                  item.itemId,

                                  () =>
                                    onUpdateCartQuantity(
                                      item.itemId,
                                      qty - 1
                                    )
                                )
                              }
                              disabled={
                                itemBusy
                              }
                            >

                              <Minus
                                size={13}
                                color="#1b1c1c"
                              />

                            </TouchableOpacity>


                            <Text
                              style={
                                styles.qtyActionText
                              }
                            >
                              {
                                itemBusy
                                  ? '…'
                                  : qty
                              }
                            </Text>


                            <TouchableOpacity
                              style={[
                                styles.qtyActionBtn,

                                itemBusy &&
                                  styles.qtyBtnBusy,
                              ]}
                              onPress={() =>
                                runItemAction(
                                  item.itemId,

                                  () =>
                                    onUpdateCartQuantity(
                                      item.itemId,
                                      qty + 1
                                    )
                                )
                              }
                              disabled={
                                itemBusy
                              }
                            >

                              <Plus
                                size={13}
                                color="#1b1c1c"
                              />

                            </TouchableOpacity>

                          </View>

                        ) : (

                          /* =================================
                             ADD BUTTON
                          ================================== */

                          <TouchableOpacity
                            style={
                              styles.addBtn
                            }
                            onPress={() =>
                              runItemAction(
                                item.itemId,

                                () =>
                                  onAddToCart(
                                    item.itemId,
                                    1,
                                    item
                                  )
                              )
                            }
                            disabled={
                              itemBusy
                            }
                          >

                            {itemBusy ? (

                              <ActivityIndicator
                                size="small"
                                color="#ffffff"
                              />

                            ) : (

                              <Plus
                                size={16}
                                color="#ffffff"
                              />

                            )}

                          </TouchableOpacity>

                        )}

                      </View>

                    </TouchableOpacity>

                  </View>

                );

              }
            )}

          </View>

        )}

      </ScrollView>


      {/* =================================================
          FLOATING CART
      ================================================== */}

      {totalCartCount > 0 && (

        <View
          style={
            styles.floatingCartBarWrapper
          }
        >

          <TouchableOpacity
            style={
              styles.floatingCartBar
            }
            onPress={
              openCart
            }
            activeOpacity={0.9}
          >

            <View
              style={
                styles.cartCountCircle
              }
            >

              <Text
                style={
                  styles.cartCountCircleText
              }
              >
                {
                  totalCartCount
                }
              </Text>

            </View>


            <Text
              style={
                styles.cartCenterText
              }
            >
              {
                totalCartCount === 1
                  ? '1 Item Added'
                  : `${totalCartCount} Items Added`
              }
            </Text>


            <View
              style={
                styles.cartRightBox
              }
            >

              <Text
                style={
                  styles.cartRightAmount
              }
              >
                ₹
                {
                  Math.round(
                    totalCartAmount
                  ) ===
                  totalCartAmount
                    ? totalCartAmount
                    : totalCartAmount.toFixed(
                        0
                      )
                }
              </Text>

              <ChevronUp
                size={20}
                color="#ffffff"
              />

            </View>

          </TouchableOpacity>

        </View>

      )}

    </View>
  );
}


/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({

    rootWrapper: {
      flex: 1,
      backgroundColor: '#FBF9F9',
      position: 'relative',
    },

    container: {
      flex: 1,
      backgroundColor: 'rgb(146, 228, 13)',
    },

    contentContainer: {
      maxWidth: 1280,
      width: '100%',
      alignSelf: 'center',

      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 110,
    },


    /* =====================================================
       CATEGORIES
    ===================================================== */

    categoriesScroll: {
      marginBottom: 16,
    },

    categoriesContainer: {
      gap: 8,
      paddingRight: 10,
    },

    categoryChip: {
      backgroundColor: '#EFEDED',

      borderWidth: 1,
      borderColor: '#E0DDD8',

      paddingHorizontal: 16,
      paddingVertical: 8,

      borderRadius: 20,
    },

    categoryChipActive: {
      backgroundColor: '#1B1C1C',
      borderColor: '#1B1C1C',
    },

    categoryChipText: {
      color: '#444748',
      fontSize: 13,
      fontWeight: '600',
    },

    categoryChipTextActive: {
      color: '#ffffff',
      fontWeight: '700',
    },


    /* =====================================================
       SEARCH
    ===================================================== */

    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 10,

      marginBottom: 20,

      maxWidth: 680,
      width: '100%',
    },

    searchBox: {
      flex: 1,

      flexDirection: 'row',
      alignItems: 'center',

      gap: 8,

      backgroundColor: '#FFFFFF',

      borderWidth: 1,
      borderColor: '#E0DDD8',

      borderRadius: 14,

      paddingHorizontal: 12,

      height: 44,
    },

    searchInput: {
      flex: 1,

      color: '#1B1C1C',

      fontSize: 13,

      outlineStyle: 'none',
    },

    vegToggle: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 6,

      backgroundColor: '#FFFFFF',

      borderWidth: 1,
      borderColor: '#E0DDD8',

      paddingHorizontal: 12,

      height: 44,

      borderRadius: 14,
    },

    vegToggleActive: {
      backgroundColor: '#DCFCE7',
      borderColor: '#86EFAC',
    },

    vegDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    vegText: {
      color: '#747878',
      fontSize: 12,
      fontWeight: '600',
    },

    vegTextActive: {
      color: '#15803d',
      fontWeight: '700',
    },


    /* =====================================================
       SECTION HEADER
    ===================================================== */

    sectionHeaderRow: {
      flexDirection: 'row',

      justifyContent:
        'space-between',

      alignItems: 'center',

      marginBottom: 14,
    },

    sectionHeaderTitle: {
      color: '#1B1C1C',

      fontSize: 19,

      fontWeight: '700',

      letterSpacing: -0.3,
    },

    itemCountBadge: {
      color: '#747878',

      fontSize: 12,

      fontWeight: '600',
    },


    /* =====================================================
       GRID
    ===================================================== */

    grid: {
      flexDirection: 'row',

      flexWrap: 'wrap',

      gap: 16,

      justifyContent:
        'flex-start',
    },


    /* =====================================================
       ITEM CARD
    ===================================================== */

    card: {
      flexGrow: 1,

      flexShrink: 0,

      flexBasis: 220,

      maxWidth: 290,

      minWidth: 175,

      minHeight: 340,

      backgroundColor: '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor: '#E0DDD8',

      padding: 12,

      justifyContent:
        'space-between',

      position: 'relative',

      shadowColor: '#000000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity: 0.03,

      shadowRadius: 4,
    },

    cardTouchable: {
      flex: 1,

      justifyContent:
        'space-between',
    },


    /* =====================================================
       REAL API IMAGE
    ===================================================== */

    itemImage: {
      width: '100%',

      height: 165,

      borderRadius: 12,

      marginBottom: 12,

      backgroundColor: '#EFEDED',
    },

    imagePlaceholder: {
      width: '100%',

      height: 165,

      borderRadius: 12,

      marginBottom: 12,

      alignItems: 'center',

      justifyContent:
        'center',

      backgroundColor: '#EFEDED',
    },

    imagePlaceholderText: {
      color: '#A0A0A0',

      fontSize: 10,

      fontWeight: '600',

      marginTop: 5,
    },


    /* =====================================================
       CARD HEADER
    ===================================================== */

    cardHeaderRow: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      marginBottom: 8,
    },

    dietBadge: {
      width: 14,

      height: 14,

      borderWidth: 1.5,

      borderRadius: 3,

      alignItems: 'center',

      justifyContent:
        'center',
    },

    vegBadgeBorder: {
      borderColor: '#15803d',
    },

    nonVegBadgeBorder: {
      borderColor: '#dc2626',
    },

    dietDot: {
      width: 5,

      height: 5,

      borderRadius: 2.5,
    },

    itemTag: {
      color: '#747878',

      fontSize: 11,

      fontWeight: '600',

      textTransform:
        'uppercase',

      letterSpacing: 0.5,

      flex: 1,
    },

    ratingPill: {
      backgroundColor: '#EFEDED',

      paddingHorizontal: 6,

      paddingVertical: 2,

      borderRadius: 6,
    },

    ratingText: {
      color: '#D33401',

      fontSize: 10,

      fontWeight: '700',
    },


    /* =====================================================
       CARD BODY
    ===================================================== */

    cardBody: {
      flex: 1,

      justifyContent:
        'center',

      marginVertical: 4,
    },

    itemName: {
      color: '#1B1C1C',

      fontSize: 15,

      fontWeight: '700',

      lineHeight: 20,

      letterSpacing: -0.2,
    },

    itemDesc: {
      color: '#747878',

      fontSize: 12,

      lineHeight: 16,

      marginTop: 4,
    },


    /* =====================================================
       BOTTOM CARD ROW
    ===================================================== */

    cardBottomRow: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      marginTop: 12,

      paddingTop: 10,

      borderTopWidth: 1,

      borderTopColor: '#EFEDED',
    },

    priceContainer: {
      justifyContent:
        'center',
    },

    priceCurrency: {
      color: '#747878',

      fontSize: 9,

      fontWeight: '700',

      textTransform:
        'uppercase',
    },

    itemPrice: {
      color: '#1B1C1C',

      fontSize: 18,

      fontWeight: '800',

      letterSpacing: -0.3,
    },


    /* =====================================================
       ADD BUTTON
    ===================================================== */

    addBtn: {
      width: 34,

      height: 34,

      borderRadius: 17,

      backgroundColor: '#D33401',

      alignItems: 'center',

      justifyContent:
        'center',

      shadowColor:
        '#D33401',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.25,

      shadowRadius: 4,
    },


    /* =====================================================
       QUANTITY
    ===================================================== */

    qtyControlRow: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 8,

      backgroundColor:
        '#EFEDED',

      borderRadius: 16,

      paddingHorizontal: 6,

      paddingVertical: 3,

      borderWidth: 1,

      borderColor: '#E0DDD8',
    },

    qtyActionBtn: {
      width: 22,

      height: 22,

      borderRadius: 11,

      backgroundColor:
        '#FFFFFF',

      alignItems: 'center',

      justifyContent:
        'center',
    },

    qtyBtnBusy: {
      opacity: 0.5,
    },

    qtyActionText: {
      color: '#1B1C1C',

      fontWeight: '800',

      fontSize: 13,

      minWidth: 16,

      textAlign: 'center',
    },


    /* =====================================================
       SOLD OUT
    ===================================================== */

    soldOutBadge: {
      backgroundColor:
        '#EFEDED',

      borderRadius: 6,

      paddingHorizontal: 8,

      paddingVertical: 4,

      alignItems: 'center',
    },

    soldOutText: {
      color: '#747878',

      fontSize: 10,

      fontWeight: '700',
    },


    /* =====================================================
       FLOATING CART
    ===================================================== */

    floatingCartBarWrapper: {
      position: 'absolute',

      bottom: 18,

      left: 16,

      right: 16,

      zIndex: 999,

      alignItems: 'center',
    },

    floatingCartBar: {
      width: '100%',

      maxWidth: 480,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      backgroundColor:
        '#D33401',

      borderRadius: 16,

      paddingVertical: 12,

      paddingHorizontal: 16,

      shadowColor:
        '#D33401',

      shadowOffset: {
        width: 0,
        height: 6,
      },

      shadowOpacity: 0.35,

      shadowRadius: 10,

      elevation: 6,
    },

    cartCountCircle: {
      width: 30,

      height: 30,

      borderRadius: 15,

      backgroundColor:
        '#FFFFFF',

      alignItems: 'center',

      justifyContent:
        'center',
    },

    cartCountCircleText: {
      color: '#D33401',

      fontWeight: '800',

      fontSize: 13,
    },

    cartCenterText: {
      color: '#FFFFFF',

      fontSize: 14,

      fontWeight: '700',

      letterSpacing: 0.2,
    },

    cartRightBox: {
      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,
    },

    cartRightAmount: {
      color: '#FFFFFF',

      fontSize: 17,

      fontWeight: '800',
    },


    /* =====================================================
       LOADER
    ===================================================== */

    loaderBox: {
      alignItems: 'center',

      justifyContent:
        'center',

      paddingVertical: 50,
    },

    loaderText: {
      color: '#747878',

      marginTop: 10,

      fontSize: 13,

      textAlign: 'center',
    },


    /* =====================================================
       EMPTY
    ===================================================== */

    emptyBox: {
      alignItems: 'center',

      justifyContent:
        'center',

      paddingVertical: 50,

      backgroundColor:
        '#FFFFFF',

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        '#E0DDD8',

      padding: 24,
    },

    emptyTitle: {
      color: '#1B1C1C',

      fontSize: 16,

      fontWeight: '700',

      marginBottom: 4,
    },

    emptySub: {
      color: '#747878',

      fontSize: 12,

      textAlign: 'center',
    },

  });