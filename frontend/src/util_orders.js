import * as util from "./util.js";
import * as modal from "./modal.js";


// display all orders onto a table
// and insert the table into the given "div"
export function fill_orders(div, data, title_text, require_tracking_btn, is_admin_view){
    // the order is returned with descending unix_time
    // we place all orders together in a table
    // columns: order_id, time, total price, status (sent / preparing), and buttons
    let h1 = document.createElement("h1");
    h1.textContent = title_text;

    let table = document.createElement("table");
    table.classList.add("big-table");
    
    // link
    util.appendListChild(div, [h1, table]);

    // the table has some columns
    let header = table.createTHead();
    let header_row = header.insertRow(-1);


    // total 5 columns for the outer table
    let th_list = [];

    // for admin view, add one more column for the customer
    if (is_admin_view){
        th_list = ["Order ID", "Time", "Total Price", "Customer", "Address", "Status", "Items"];
    }
    else {
        th_list = ["Order ID", "Time", "Total Price", "Address", "Status", "Items"];
    }


    // if require tracking update, then add a column
    if (require_tracking_btn){
        th_list.push("Add Tracking");
    }

    for (let i = 0; i < th_list.length; i++){
        let th = header_row.insertCell(-1);
        th.textContent = th_list[i];
    }

    
    // table body
    let tbody = table.createTBody();
    
    // each row represents a data
    // and another row includes all the items
    for (let i = 0; i < data.length; i++){
        let tr = tbody.insertRow(-1);

        // 5 columns or 6 columns (when need to add tracking)
        for (let j = 0; j < th_list.length; j++){
            let td = tr.insertCell(-1);
        }

        let td_list = tr.getElementsByTagName("td");

        // order_id
        td_list[0].textContent = `#${data[i]['ord_id']}`;

        // time
        td_list[1].textContent = new Date(data[i]['unix_time'] * 1000).toLocaleString();

        // total price
        td_list[2].textContent = `$ ${data[i]['total_price']}`;
        
        // for admin view, here needs to set the customer name
        // also name the index
        let j = 3;

        if (is_admin_view){
            td_list[3].textContent = `${data[i]['first_name']} ${data[i]['last_name']}`;
            td_list[3].classList.add("pointer-underline");
            td_list[3].addEventListener("click", function(){
                window.location.href = `account.html?user_id=${data[i]['user_id']}`;
            });


            j = 4;
        }


        // address
        td_list[j].textContent = util.form_full_address_text(data[i]['address']);
        j += 1;

        // status
        if (data[i]['tracking'] != null){
            td_list[j].textContent = `Sent  #${data[i]['tracking']}`;
            td_list[j].classList.add("underline");

            td_list[j].addEventListener("click", function(){
                window.location.href = `https://auspost.com.au/mypost/track/#/details/${data[i]['tracking']}`;
                return;
            })
        }
        else{
            td_list[j].textContent = "Preparing for delivery";
        }

        j += 1;

        // the view has a button inside
        // click the button can review the small table with all order items
        // and click again to close
        let btn_view = document.createElement("button");
        btn_view.textContent = "View";
        td_list[j].appendChild(btn_view);
        j += 1;
        
        // if require tracking btn
        if (require_tracking_btn){
            // add a button
            let btn_tracking = document.createElement("button");
            btn_tracking.textContent = "Add";
            td_list[j].appendChild(btn_tracking);

            // click, a modal window
            btn_tracking.addEventListener("click", function(){
                let mw = modal.create_complex_modal_with_text(
                    "Add Tracking Number", "", "Submit", "Close"
                );

                util.removeAllChild(mw['body']);

                let row = document.createElement("div");
                row.classList.add("row");

                let label = document.createElement("label");
                label.textContent = "Tracking Number";

                let input = document.createElement("input");
                input.type = "text";
                input.placeholder = "AuPost Tracking Number";

                // link
                mw['body'].appendChild(row);
                util.appendListChild(row, [label, input]);


                // close button
                mw['footer_btn_2'].addEventListener("click", function(){
                    util.removeSelf(mw['modal']);
                    return;
                });

                mw['footer_btn_1'].addEventListener("click", async function(){
                    let value = input.value;

                    let url = `http://localhost:5000/admin/orders/${data[i]['ord_id']}`;
                    let init = {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${sessionStorage.getItem("token")}`,
                            'accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            'tracking': value,
                        }),
                    };

                    try {
                        let response = await fetch(url, init);
                        if (response.ok){
                            util.removeSelf(mw['modal']);

                            let mw2 = modal.create_simple_modal_with_text(
                                "Add Tracking Successful",
                                "You have successfully added the tracking to this order. The customer can view this tracking on their orders page.",
                                "OK"
                            );

                            mw2['footer_btn'].addEventListener("click", function(){
                                window.location.reload();
                                return;
                            });
                        }
                        else if (response.status == 403){
                            modal.create_force_logout_modal();
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
                });
            });
        }


        // another table
        let tr_detail = table.insertRow(-1);
        tr_detail.style.display = "none";

        // btn_view click event listener
        btn_view.addEventListener("click", function(){
            if (tr_detail.style.display == "none"){
                tr_detail.style.display = "block";
                btn_view.textContent = "Close View";
            }
            else{
                tr_detail.style.display = "none";
                btn_view.textContent = "View";
            }

            return;
        });

        let td_detail = tr_detail.insertCell(-1);
        td_detail.colSpan = "5";  // fill all columns
        td_detail.classList.add("no-border");

        // now focus on the small table
        let small_table = document.createElement("table");
        small_table.classList.add("small-table");

        td_detail.appendChild(small_table);

        let small_header = small_table.createTHead();
        let small_header_row = small_header.insertRow(-1);

        // total actually five columns 
        // but col "Item" has two columns, one for the image, one for name
        let small_th_list = ["Item", "Quantity", "Unit Price", "Purchase Snapshot"];

        for (let j = 0; j < small_th_list.length; j++){
            let th = small_header_row.insertCell(-1);
            th.textContent = small_th_list[j];

            if (small_th_list[j] == "Item"){
                th.colSpan = 2;
            }
        }

        let small_tbody = small_table.createTBody();

        // list all items
        for (let j = 0; j < data[i]['items'].length; j++){
            let item_data = data[i]['items'][j];
            let snapshot = JSON.parse(item_data['snapshot']);

            let tr = small_tbody.insertRow(-1);

            // 5 columns
            for (let k = 0; k < 5; k++){
                tr.insertCell(-1);
            }

            let td_list = tr.getElementsByTagName("td");
            
            // first column : img
            let img = document.createElement("img");
            img.src = snapshot['photos'][0];
            td_list[0].appendChild(img);

            // second column: name
            // the name can be clicked to the product page
            td_list[1].textContent = snapshot['simple']['name'];
            td_list[1].classList.add("underline");
            td_list[1].addEventListener("click", function(){
                window.location.href = `item.html?item_id=${item_data['item_id']}`;
                return;
            });

            // col 3: quantity
            td_list[2].textContent = `×${item_data['quantity']}`;

            // col 4: unit price
            td_list[3].textContent = `$ ${item_data['price']}`;

            // col 5: button view snapshot
            let btn_snapshot = document.createElement("button");
            btn_snapshot.textContent = "View";
            td_list[4].appendChild(btn_snapshot);

            // snapshot
            btn_snapshot.addEventListener("click", function(){
                localStorage.setItem(item_data['item_id'], item_data['snapshot']);
                window.location.href = `item.html?item_id=${item_data['item_id']}&type=snapshot`;
                return;
            });
        }
    }

    return;
}

export function fill_no_orders(div, title_text){
    // the order is returned with descending unix_time
    // we place all orders together in a table
    // columns: order_id, time, total price, status (sent / preparing), and buttons
    let h1 = document.createElement("h1");
    h1.textContent = title_text;

    let h2 = document.createElement("h2");
    h2.textContent = "No orders yet.";

    util.appendListChild(div, [h1, h2]);
    return;
}


export function fill_order_rating(div, data){
    let h1 = document.createElement("h1");
    h1.textContent = "Your Ratings";

    let h2 = document.createElement("h2");
    h2.textContent = "Please rate your purchased items so we can provide better recommendations for you.";

    let table = document.createElement("table");
    table.classList.add("big-table");
    
    // link
    util.appendListChild(div, [h1, h2, table]);

    // the table has some columns
    let header = table.createTHead();
    let header_row = header.insertRow(-1);

    // total 5 columns for the outer table
    let header_cell_1 = header_row.insertCell(-1);
    header_cell_1.colSpan = 2;
    header_cell_1.textContent = "Item";

    let header_cell_2 = header_row.insertCell(-1);
    header_cell_2.textContent = "Rating";


    // body
    let tbody = table.createTBody();
    
    // each row represents a data
    // and another row includes all the items
    for (let i = 0; i < data.length; i++){
        let tr = tbody.insertRow(-1);

        // image
        let td_1 = tr.insertCell(-1);
        let img = document.createElement("img");
        img.src = data[i]['photo'];
        td_1.appendChild(img);

        // name
        let td_2 = tr.insertCell(-1);
        td_2.textContent = data[i]['name'];
        td_2.classList.add("pointer-underline");
        td_2.addEventListener("click", function(){
            window.location.href = `item.html?item_id=${data[i]['item_id']}`;
            return;
        });

        // 5 starts
        let td_3 = tr.insertCell(-1);
        let stars = [];

        for (let j = 0; j < 5; j++){
            let star = util.createMaterialIcon("i", "star");
            td_3.appendChild(star);
            stars.push(star);

            if (data[i]['rating'] == null || j+1 > data[i]['rating']){
                star.classList.add("no-rated");
            }
            else {
                star.classList.add("rated");
            }
        }

        for (let j = 0; j < stars.length; j++){
            stars[j].addEventListener("click", async function(){
                // style all starts from the first one up to this
                for (let k = 0; k < stars.length; k++){
                    if (k <= j){
                        stars[k].classList.add("rated");
                        stars[k].classList.remove("no-rated");
                    }
                    else {
                        stars[k].classList.remove("rated");
                        stars[k].classList.add("no-rated");
                    }
                }


                // post to the backend
                let url = `http://localhost:5000/rating/${data[i]['item_id']}`;
                
                let init = {
                    method: 'PUT',
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `token ${sessionStorage.getItem("token")}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "Rating": j+1,
                    }),
                };

                try {
                    let response = await fetch(url, init);

                    if (response.ok){
                        let mw = modal.create_simple_modal_with_text(
                            "Rating Submission Success",
                            "Thank you for updaing your rating. These ratings will help us to better recommend products to you. Refreshing pages now.",
                            "OK",
                        );

                        mw['footer_btn'].addEventListener("click", function(){
                            window.location.reload();
                            return;
                        });
                    }
                    else if (response.status == 403){
                        modal.create_force_logout_modal();
                    }
                    else {
                        let text = await response.text();
                        throw Error(text);
                    }
                }
                catch(err) {
                    alert("error");
                    console.log(err);
                }
            })
        }
    }

    return;
}


