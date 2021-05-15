import {navbar_set_up} from "./navbar.js"
import * as util from "./util.js";
import * as modal from "./modal.js";
import * as rec from "./recommender.js";
import * as util_orders from "./util_orders.js";


util.addLoadEvent(navbar_set_up);
util.addLoadEvent(page_set_up);


async function page_set_up(){
    // only admin can access

    if (sessionStorage.getItem("role") !== "0"){
        let mw = modal.create_simple_modal_with_text(
            "No Access",
            "Sorry. You cannot access this page. Redirecting to the home page..",
            "OK",
        );

        mw['footer_btn'].addEventListener("click", function(){
            window.location.href = "index.html";
            return;
        });

        return;
    }

    // main tag
    let main = document.getElementsByTagName("main")[0];

    // two sections: new orders, and finished ordrs
    let new_orders = document.createElement("div");
    new_orders.classList.add("orders");

    let old_orders = document.createElement("div");
    old_orders.classList.add("orders");

    util.appendListChild(main, [new_orders, old_orders]);

    // fetch all orders
    let url = "http://localhost:5000/admin/orders";
    let init = {
        method: 'GET',
        headers: {
            'Authorization': `token ${sessionStorage.getItem("token")}`,
            'accept': 'application/json',
        },
    };

    try {
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();

            console.log(data);

            // there are two sections: new and old
            if (data['new'].length == 0){
                util_orders.fill_no_orders(new_orders, "New Orders");
            }
            else{
                util_orders.fill_orders(new_orders, data['new'], "New orders", true, true);
            }

            if (data['old'].length == 0){
                util_orders.fill_no_orders(old_orders, "Finalized Orders");
            }
            else{
                util_orders.fill_orders(old_orders, data['old'], "Finalized orders", false, true);
            }
        }
        else if (response.status == 403){
            modal.create_force_logout_modal();
            return;
        }
        else{
            let text = await response.text();
            throw Error(text);
        }
    }
    catch(err){
        alert("error");
        console.log(err);
    }
}

