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
   COLOR PALETTE
========================================================= */

const COLORS = {
  orange: '#F47A24',
  orangeDark: '#E96816',
  orangeLight: '#FFF1E8',
  orangeSoft: '#fcf7f3',

  background: '#FFFCFA',
  white: '#FFFFFF',

  text: '#171717',
  textSecondary: '#8C8885',
  textMuted: '#AAA5A1',

  softGray: '#F7F5F3',
  gray: '#EFECE9',
  border: '#EEE8E3',

  green: '#15803D',
  greenLight: '#DCFCE7',

  red: '#DC2626',

  placeholder: '#F5F3F1',
};


/* =========================================================
   ITEM IMAGE
   Same working logic as Basket:
   direct URI -> Image
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

  const cleanUri =
    typeof uri === 'string'
      ? uri.trim()
      : '';

  const hasValidUri =
    cleanUri !== '' &&
    cleanUri !== IMAGE_NOT_AVAILABLE;

  if (!hasValidUri || hasError) {
    return (
      <View
        style={[
          style,
          styles.imagePlaceholder,
        ]}
      >
        <Store
          size={28}
          color={COLORS.textMuted}
        />

        <Text
          style={
            styles.imagePlaceholderText
          }
        >
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{
        uri: cleanUri,
      }}
      style={style}
      resizeMode={resizeMode}
      onLoad={() => {
        console.log(
          'CUSTOMER IMAGE LOADED:',
          cleanUri
        );
      }}
      onError={(error) => {
        console.log(
          'CUSTOMER IMAGE FAILED:',
          cleanUri,
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
     
     IMPORTANT:
     Basket uses:
     
       item.imageUrl
     
     directly.
     
     CustomerView now does the same.
  ======================================================= */

  const getDisplayImage =
    (item, cartItem = null) => {

      if (!item && !cartItem) {
        return '';
      }


      /* ===================================================
         1. EXACT SAME FIELD AS BASKET
      =================================================== */

      const directImageUrl =
        cartItem?.imageUrl ||
        item?.imageUrl ||
        '';

      if (
        typeof directImageUrl === 'string' &&
        directImageUrl.trim() !== '' &&
        directImageUrl.trim() !== IMAGE_NOT_AVAILABLE
      ) {
        const cleanDirectUrl =
          directImageUrl.trim();

        const resolved =
          getItemImageUrl(
            cleanDirectUrl,
            item?.isVeg !== false
          );

        return resolved || cleanDirectUrl;
      }


      /* ===================================================
         2. OTHER POSSIBLE API IMAGE FIELDS
      =================================================== */

      const imageCandidates = [

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
        );


      if (!apiImage) {

        console.log(
          'NO IMAGE FOUND FOR CUSTOMER ITEM:',
          item?.itemName,
          'ITEM ID:',
          item?.itemId,
          'FULL ITEM:',
          item
        );

        return '';
      }


      const cleanImage =
        apiImage.trim();


      /* ===================================================
         3. COMPLETE API URL
      =================================================== */

      if (
        cleanImage.startsWith(
          'http://'
        ) ||
        cleanImage.startsWith(
          'https://'
        ) ||
        cleanImage.startsWith(
          'data:'
        )
      ) {

        console.log(
          'CUSTOMER COMPLETE IMAGE URL:',
          item?.itemName,
          '=>',
          cleanImage
        );

        return cleanImage;
      }


      /* ===================================================
         4. RELATIVE API IMAGE PATH
      =================================================== */

      const generatedUrl =
        getItemImageUrl(
          cleanImage,
          item?.isVeg !== false
        );


      console.log(
        'CUSTOMER GENERATED IMAGE:',
        item?.itemName,
        'SOURCE:',
        cleanImage,
        'FINAL:',
        generatedUrl
      );


      return generatedUrl || '';
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
              size={20}
              color={COLORS.textSecondary}
            />

            <TextInput
              style={
                styles.searchInput
              }
              placeholder={
                `Search dishes in ${restaurantName}...`
              }
              placeholderTextColor={
                COLORS.textMuted
              }
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
              style={
                styles.vegDot
              }
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
              color={
                COLORS.orange
              }
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
                          REAL API IMAGE
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
                                    ? COLORS.green
                                    : COLORS.red,
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

                      {(() => {
                        const unitName =
                          item.unitName ||
                          item.unitDescription ||
                          (typeof getUnitDescription === 'function'
                            ? getUnitDescription(item)
                            : '') ||
                          '';

                        return (
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
                                INR {unitName ? `• ${unitName}` : ''}
                              </Text>

                              <View style={styles.priceWithUnitRow}>
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

                                {unitName ? (
                                  <Text style={styles.unitPerText}>
                                    /{unitName}
                                  </Text>
                                ) : null}
                              </View>
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
                                    color={
                                      COLORS.text
                                    }
                                  />
                                </TouchableOpacity>

                                <View style={styles.qtyLabelWrap}>
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

                                  {unitName ? (
                                    <Text
                                      style={
                                        styles.qtyUnitSubText
                                      }
                                      numberOfLines={1}
                                    >
                                      {unitName}
                                    </Text>
                                  ) : null}
                                </View>

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
                                    color={
                                      COLORS.text
                                    }
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
                                    color={
                                      COLORS.white
                                    }
                                  />
                                ) : (
                                  <Plus
                                    size={16}
                                    color={
                                      COLORS.white
                                    }
                                  />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })()}

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
                color={
                  COLORS.white
                }
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
      backgroundColor: COLORS.background,
      position: 'relative',
    },

    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    contentContainer: {
      maxWidth: 1280,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 14,
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
      backgroundColor: COLORS.orangeLight,
      borderWidth: 1,
      borderColor: '#F8E1D2',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 22,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },

    categoryChipActive: {
      backgroundColor: COLORS.orange,
      borderColor: COLORS.orange,
      shadowColor: COLORS.orange,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 5,
      elevation: 2,
    },

    categoryChipText: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '600',
    },

    categoryChipTextActive: {
      color: COLORS.white,
      fontWeight: '700',
    },

    /* =====================================================
       SEARCH & CONTROLS
    ===================================================== */
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 18,
      maxWidth: 680,
      width: '100%',
    },

    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      height: 44,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
    },

    searchInput: {
      flex: 1,
      color: COLORS.text,
      fontSize: 13,
      outlineStyle: 'none',
    },

    /* =====================================================
       VEG TOGGLE
    ===================================================== */
    vegToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 14,
      flexShrink: 0,
    },

    vegToggleActive: {
      backgroundColor: COLORS.greenLight,
      borderColor: '#86EFAC',
    },

    vegDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.green,
    },

    vegText: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },

    vegTextActive: {
      color: COLORS.green,
      fontWeight: '700',
    },

    /* =====================================================
       SECTION HEADER
    ===================================================== */
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    sectionHeaderTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },

    itemCountBadge: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },

    /* =====================================================
       RESPONSIVE GRID
    ===================================================== */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'flex-start',
    },

    /* =====================================================
       RESPONSIVE ITEM CARD
    ===================================================== */
    card: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 155,
      minWidth: 140,
      maxWidth: 295,
      minHeight: 310,
      backgroundColor: COLORS.white,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#F0ECE9',
      padding: 10,
      justifyContent: 'space-between',
      position: 'relative',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },

    cardTouchable: {
      flex: 1,
      justifyContent: 'space-between',
    },

    /* =====================================================
       ITEM IMAGE
    ===================================================== */
    itemImage: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 10,
      backgroundColor: COLORS.placeholder,
    },

    imagePlaceholder: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.placeholder,
    },

    imagePlaceholderText: {
      color: COLORS.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 4,
    },

    /* =====================================================
       CARD HEADER (TAG / DIET)
    ===================================================== */
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      flexWrap: 'nowrap',
    },

    dietBadge: {
      width: 14,
      height: 14,
      borderWidth: 1.5,
      borderRadius: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.white,
      flexShrink: 0,
    },

    vegBadgeBorder: {
      borderColor: COLORS.green,
    },

    nonVegBadgeBorder: {
      borderColor: COLORS.red,
    },

    dietDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },

    itemTag: {
      color: COLORS.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      flex: 1,
    },

    ratingPill: {
      backgroundColor: COLORS.orangeSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      flexShrink: 0,
    },

    ratingText: {
      color: COLORS.orangeDark,
      fontSize: 9,
      fontWeight: '700',
    },

    /* =====================================================
       CARD BODY
    ===================================================== */
    cardBody: {
      flex: 1,
      justifyContent: 'center',
      marginVertical: 2,
    },

    itemName: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
      letterSpacing: -0.2,
    },

    itemDesc: {
      color: COLORS.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 3,
    },

    /* =====================================================
       BOTTOM CARD ROW
    ===================================================== */
    cardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#F3EFEC',
      gap: 6,
    },

    priceContainer: {
      justifyContent: 'center',
      flexShrink: 1,
    },

    priceCurrency: {
      color: COLORS.textMuted,
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    priceWithUnitRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },

    unitPerText: {
      color: COLORS.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },

    itemPrice: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },

    /* =====================================================
       ADD BUTTON
    ===================================================== */
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: COLORS.orange,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 4,
      elevation: 3,
      flexShrink: 0,
    },

    /* =====================================================
       QUANTITY CONTROL
    ===================================================== */
    qtyControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.orangeLight,
      borderRadius: 18,
      paddingHorizontal: 5,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: '#F7D9C6',
      flexShrink: 0,
    },

    qtyActionBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
    },

    qtyBtnBusy: {
      opacity: 0.5,
    },

    qtyLabelWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
      minWidth: 24,
    },

    qtyActionText: {
      color: COLORS.text,
      fontWeight: '800',
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 14,
    },

    qtyUnitSubText: {
      fontSize: 9,
      fontWeight: '700',
      color: COLORS.orangeDark,
      textTransform: 'capitalize',
      marginTop: 1,
    },

    /* =====================================================
       SOLD OUT
    ===================================================== */
    soldOutBadge: {
      backgroundColor: COLORS.gray,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: 'center',
      flexShrink: 0,
    },

    soldOutText: {
      color: COLORS.textSecondary,
      fontSize: 10,
      fontWeight: '700',
    },

    /* =====================================================
       FLOATING CART BAR
    ===================================================== */
    floatingCartBarWrapper: {
      position: 'absolute',
      bottom: 16,
      left: 14,
      right: 14,
      zIndex: 999,
      alignItems: 'center',
    },

    floatingCartBar: {
      width: '100%',
      maxWidth: 480,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLORS.orange,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: COLORS.orange,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 7,
    },

    cartCountCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
    },

    cartCountCircleText: {
      color: COLORS.orangeDark,
      fontWeight: '800',
      fontSize: 13,
    },

    cartCenterText: {
      color: COLORS.white,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    cartRightBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    cartRightAmount: {
      color: COLORS.white,
      fontSize: 16,
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
      color:
        COLORS.textSecondary,

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
        COLORS.white,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        COLORS.border,

      padding: 24,
    },


    emptyTitle: {
      color:
        COLORS.text,

      fontSize: 16,

      fontWeight: '800',

      marginBottom: 4,
    },


    emptySub: {
      color:
        COLORS.textSecondary,

      fontSize: 12,

      textAlign: 'center',
    },

  });