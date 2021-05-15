import * as util from './util.js';
import * as modal from "./modal.js";
import * as util_cart from "./util_cart.js";


// create a navigation bar from the html nav tag
// or use class navbar to locate this tag

// for everyone:
//      show: (logo, home, products, search bar) on the left

// for non-login user:       
//      show: (login, register) on the right

// for login user:
//      show: (my account, cart, logout) on the right

// for admin:
//      show: (add new product) on the left
//      show (customers, orders, stocks, reports, logout) on the right


export function navbar_set_up(){
    let navbar = document.getElementsByTagName("nav")[0];

    // navbar has left and right parts
    let navbar_left = document.createElement("div");
    navbar_left.classList.add("left");

    // right is all buttons, change to ul
    let navbar_right = document.createElement("ul");
    navbar_right.classList.add("right");

    util.appendListChild(navbar, [navbar_left, navbar_right]);

    // left side is always the same: logo, home, products, search
    let logo = document.createElement("img");
    logo.src = "img/logo_ppt_4_nobg.png";
    logo.alt = "Laptop website logo";

    let nav_bar_left_ul = document.createElement("ul");
    
    util.appendListChild(navbar_left, [logo, nav_bar_left_ul]);

    // inside the ul, some buttons
    let home = util.createMaterialIcon("li", "home");
    home.title = "Homepage";
    home.addEventListener("click", function(){
        window.location.href = "index.html";
        return;
    });

    let products = util.createMaterialIcon("li", "important_devices");
    products.title = "Product List";
    products.addEventListener("click", function(){
        window.location.href = "products.html";
        return;
    })

    // search bar
    let search = document.createElement("li");

    let input_i = util.createMaterialIcon("div", "search");
    input_i.classList.add("icon");

    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search";

    util.appendListChild(search, [input_i, input]);

    input.addEventListener("keyup", function(e){
        if (e.keyCode == 13){
            let keyword = input.value.replace(/\ /, "%20");
            window.location.href = `products.html?keyword=${keyword}`;
            return;
        }
    });

    // link
    util.appendListChild(nav_bar_left_ul, [home, products, search]);

    // the right side, check the sessionStorage first
    if (sessionStorage.getItem("token")){
        if (sessionStorage.getItem("role") == 0){
            // new product button
            let new_item = util.createMaterialIcon("li", "note_add");
            new_item.title = "Add New Product";
            new_item.addEventListener("click", function(){
                window.location.href = "item.html?type=new";
                return;
            });

            // admin
            let customers = util.createMaterialIcon("li", "people");
            customers.title = "Customer Profiles";
            customers.addEventListener("click", function(){
                window.location.href = "customers.html";
                return;
            })

            let orders = util.createMaterialIcon("li", "request_quote");
            orders.title = "Orders";
            orders.addEventListener("click", function(){
                window.location.href = "orders.html";
                return;
            })

            let reports = util.createMaterialIcon("li", "summarize");
            reports.title = "Sale Reports";
            reports.addEventListener("click", function(){
                window.location.href = "reports.html";
                return;
            })

            let myaccount = util.createMaterialIcon("li", "account_box");
            myaccount.title = "My Profile";
            myaccount.addEventListener("click", function(){
                window.location.href = "account.html";
                return;
            })

            util.appendListChild(navbar_right,[
                new_item, orders, reports, customers, myaccount
            ]);
        }
        else{
            // user
            let myaccount = util.createMaterialIcon("li", "account_box");
            myaccount.title = "My Account";
            myaccount.addEventListener("click", function(){
                window.location.href = "account.html";
                return;
            })
            

            let mycart = util.createMaterialIcon("li", "shopping_cart");
            mycart.title = "Shopping Cart";
            mycart.addEventListener("click", function(){
                window.location.href = "checkout.html";
                return;
            })

            // if something in cart, add a symbol
            if (! util_cart.isCartEmpty()){
                let snooze = document.createElement("i");
                snooze.classList.add("material-icons");
                snooze.textContent = "snooze";
                mycart.appendChild(snooze);
            }

            util.appendListChild(navbar_right, [
                myaccount, mycart
            ]);
        }

        // common logout button
        let logout = util.createMaterialIcon("li", "logout");
        logout.title = "Log Out";
        logout.addEventListener("click", function(){
            logout_handler();
            return;
        });

        navbar_right.appendChild(logout);
    }
    else{
        // non-registered user
        let login = util.createMaterialIcon("li", "login");
        login.title = "Log In";
        login.addEventListener("click", function(){
            window.location.href = "login.html";
            return;
        })

        let register = util.createMaterialIcon("li", "person_add");
        register.title = "Sign Up";
        register.addEventListener("click", function(){
            window.location.href = "register.html";
            return;
        })

        util.appendListChild(navbar_right, [login, register]);
    }

    return;
}


function logout_handler(){
    let mw = modal.create_complex_modal_with_text(
        "Confirm Log Out",
        "Are you sure to log out?",
        "Yes", 
        "No"
    );

    mw['footer_btn_1'].addEventListener("click", function(){
        localStorage.clear();
        sessionStorage.clear();
        util.removeSelf(mw['modal']);

        window.location.href = "index.html";
        return;
    });

    mw['footer_btn_2'].addEventListener("click", function(){
        util.removeSelf(mw['modal']);
        return;
    });

    return;    
}