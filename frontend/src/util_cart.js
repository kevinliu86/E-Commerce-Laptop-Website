// This file includes all functions for the cart usage

// cart: get cart, add item to cart, increase quantity by 1, decrease quantity by 1, remove item
export function getCart(){
    return JSON.parse(sessionStorage.getItem("cart"));
}

function saveToCart(cart){
    sessionStorage.setItem("cart", JSON.stringify(cart));
    return;
}

// add to cart: default quantity = 1
export function addToCart(item_id, item_name, src, price){
    let cart = getCart();

    if (cart == null){
        cart = {'total': 0};
    }

    if (item_id in cart){
        // if alredy in cart
        cart[item_id]['quantity'] += 1;
    }
    else{
        cart[item_id] = {
            'name': item_name,
            'quantity': 1,
            'price': price,
            'src': src
        };
    }

    cart['total'] = parseFloat(cart['total']) + parseFloat(cart[item_id]['price']);
    cart['total'] = Math.round(cart['total'] * 100) / 100;

    saveToCart(cart);

    return;
}

export function cartAddQuantity(item_id){
    if (isCartEmpty()){
        alert("error");
        console.log(`Cart Error: Cart is still empty`);
        return;
    }

    let cart = getCart();

    if (item_id in cart){
        // the frontend should preven the quantity go over 10
        if (cart[item_id]['quantity'] == 10){
            alert("error");
            console.log(`Cart error: item_id ${item_id} already have 10 in the cart`);
            return;
        }

        cart[item_id]['quantity'] += 1;
        
        cart['total'] = parseFloat(cart['total']) + parseFloat(cart[item_id]['price']);
        cart['total'] = Math.round(cart['total'] * 100) / 100;

        saveToCart(cart);
    }
    else{
        alert("error");
        console.log(`Cart error: item_id ${item_id} not in the cart yet`);
    }

    return;
}

export function cartReduceQuantity(item_id){
    if (isCartEmpty()){
        alert("error");
        console.log(`Cart Error: Cart is still empty`);
        return;
    }

    let cart = getCart();

    if (item_id in cart){
        cart['total'] = parseFloat(cart['total']) - parseFloat(cart[item_id]['price']);
        cart['total'] = Math.round(cart['total'] * 100) / 100;

        // the frontend should preven the quantity go over 10
        if (cart[item_id]['quantity'] == 1){
            delete cart['item_id'];
        }
        else {
            cart[item_id]['quantity'] -= 1;
        }

        saveToCart(cart);
    }
    else{
        alert("error");
        console.log(`Cart error: item_id ${item_id} not in the cart yet`);
    }

    return;
}


export function cartRemoveItem(item_id){
    if (isCartEmpty()){
        alert("error");
        console.log(`Cart Error: Cart is still empty`);
        return;
    }

    let cart = getCart();

    if (item_id in cart){
        cart['total'] = parseFloat(cart['total']) - parseInt(cart[item_id]['quantity']) * parseFloat(cart[item_id]['price']);
        cart['total'] = Math.round(cart['total'] * 100) / 100;

        delete cart[item_id];
        saveToCart(cart);
    }
    else{
        alert("error");
        console.log(`Cart error: item_id ${item_id} not in the cart yet`);
    }

    return;
}


export function isItemInCart(item_id){
    let cart = getCart();
    return cart !== null && item_id in cart;
}

export function isCartEmpty(){
    let cart = getCart();
    return cart == null || Object.keys(cart).length == 1;
}

export function cartGetTotal(){
    if (isCartEmpty()){
        alert("error");
        console.log(`Cart Error: cart is empty for the cart get total function`);
        return;
    }

    let cart = getCart();
    return cart['total'];
}

export function emptyCart(){
    sessionStorage.removeItem("cart");

    let cart = {
        'total': 0
    };

    saveToCart(cart);
    return;
}