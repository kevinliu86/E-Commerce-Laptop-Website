import * as util from "./util.js";
import {navbar_set_up} from "./navbar.js";
import * as modal from "./modal.js";
import * as rec from "./recommender.js";
import * as util_cart from "./util_cart.js";


util.addLoadEvent(navbar_set_up);
util.addLoadEvent(page_set_up);
util.addLoadEvent(recommenders_set_up);


// This page supports for 3 view format
// PURCHASE is for customer, or not logged in user
// SHAPSHOT: only for registered customer view their purchase snapshot
// PREVIEW: admin edit the specification
const PURCHASE = 0;
const SNAPSHOT = 1;
const PREVIEW = 2;
const NEW = 3;


// url format = "item.html?item_id=xxx&typ=xxx"
// for customer: type = null (can purchase), type = snapshot (cannot purchase, but can view)
// for admin: type = null (view), type = edit (edit the specification)
async function page_set_up(){
    let search = new URLSearchParams(window.location.search.substring(1));

    let item_id = search.get("item_id");
    let type = search.get("type");

    // type = snapshot, require the customer role
    // type = edit, require the admin role
    // snapshot: read the data from the local storage and then display
    let data = JSON.parse(localStorage.getItem(item_id));

    // valid: check 4 modes: purchase, snapshot, preview, new
    let is_valid_0 = type == null && (! isNaN(item_id));
    let is_valid_1 = type == "snapshot" && data !== null && sessionStorage.getItem("role") !== null && (! isNaN(item_id));
    let is_valid_2 = type == "edit" && sessionStorage.getItem("role") == 0 && (! isNaN(item_id));
    let is_valid_3 = type == "new" && sessionStorage.getItem("role") == 0;
    

    if (! (is_valid_0 || is_valid_1 || is_valid_2 || is_valid_3)){
        let mw = modal.create_simple_modal_with_text(
            "Website Error",
            "Sorry. The request you made is invalid. Redirecting you to the home page.",
            "OK",
        );

        mw['footer_btn'].addEventListener("click", function(){
            window.location.href = "index.html";
            return;
        })

        return; 
    }


    // now, all clear
    if (type == "snapshot"){
        put_item_on_page(data, SNAPSHOT, null);
    }
    else{
        // purchase, preview, new
        let url = null;

        let init = {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        if (type === "new") {
            url = "http://localhost:5000/item/empty";
            init['headers']['Authorization'] = `token ${sessionStorage.getItem("token")}`;
        }
        else {
            url = `http://localhost:5000/item/id/${item_id}`;

            // if it is the logged in user, add the token into it 
            // so the backend can refresh the view history
            if (sessionStorage.getItem("role") == 1){
                init['headers']['Authorization'] = `token ${sessionStorage.getItem("token")}`;
            }
        }


        try{
            let response = await fetch(url, init);

            if (! response.ok){
                let mw = modal.create_simple_modal_with_text(
                    "Item Not Found", 
                    "Sorry. The item may not exist or removed from the shelf. Please try again later. Redirecting you to the products page.",
                    "OK",
                )

                mw['footer_btn'].addEventListener("click", function(){
                    window.location.href = "products.html";
                    return;
                });

                return;
            }

            let data = await response.json();
            
            if (type == "edit"){
                put_edit_item_or_new_item_on_page(data, PREVIEW);
            }
            else if (type == "new"){
                put_edit_item_or_new_item_on_page(data, NEW);
            }
            else {
                put_item_on_page(data, PURCHASE, null);
            }
        }
        catch(err){
            alert("error");
            console.log(err);
        }
    }
    
    return;
}


function recommenders_set_up(){
    let rec_dict = rec.getAllRecommenderDivs();

    // for recommender on the item page
    // only for customer (logged in & not logged in)

    if (sessionStorage.getItem("role") == 1){
        // require token
        // rec.fill_view_history_or_recommender_with_token(rec_dict.byitem, "byitem");
        rec.fill_view_history_or_recommender_with_token(rec_dict.viewhistory, "viewhistory");
        rec.fill_view_history_or_recommender_with_token(rec_dict.byviewhistory, "byviewhistory");
        
    }
    else if (sessionStorage.getItem("role") == null){
        rec.fill_top_selling_or_top_view(rec_dict.topselling, true);
        rec.fill_top_selling_or_top_view(rec_dict.topview, false);
    }

    return;
}


function put_edit_item_or_new_item_on_page(original_data, status){
    // merge two dicts
    // since when send to the backend, simply use the key => value pair is enough
    let merged_data = Object.assign({}, original_data['simple'], original_data['detail']);

    let specs_data_list = provide_specs_list_for_edit(merged_data);

    let div_edit = document.getElementsByClassName("edit")[0];
    fill_edit_with_data(original_data, div_edit, merged_data, specs_data_list, status);

    // assign the change event listener
    assign_change_event_listener_to_inputs(original_data, status);

    // display the preview first
    put_item_on_page(original_data, status, original_data);

    // add a submit button, assign the submit function
    assign_submit_button_after_preview(status, original_data);

    return;
}


// status = PREVIEW or NEW
// buttons are the same, minor difference in functions
function assign_submit_button_after_preview(status, original_data){
    let main = document.getElementsByTagName("main")[0];

    // three buttons: submit, reset, cancel
    let div_btns = document.createElement("div");
    div_btns.classList.add("edit-btns");
    main.appendChild(div_btns);
    
    // three buttons
    let btn_submit = document.createElement("button");
    btn_submit.textContent = "Submit";

    let btn_reset = document.createElement("button");
    btn_reset.textContent = "Reset";

    let btn_cancel = document.createElement("button");
    btn_cancel.textContent = "Cancel";

    // link
    util.appendListChild(div_btns, [btn_submit, btn_reset, btn_cancel]);

    // reset function
    btn_reset.addEventListener("click", function(){
        let mw = modal.create_complex_modal_with_text(
            "Reset Confirmation",
            "You are going to reset this page. All existing works you made will be lost. Do you want to proceed?",
            "Yes", "Cancel",
        );

        mw['footer_btn_1'].addEventListener("click", function(){
            window.location.reload();
            return;
        });

        mw['footer_btn_2'].addEventListener("click", function(){
            util.removeSelf(mw['modal']);
            return;
        });

        return;
    });


    // cancel button
    btn_cancel.addEventListener("click", function(){
        let mw = modal.create_complex_modal_with_text(
            "Cancel Confirmation",
            "You are going to cancel this edit. All existing works you made will be lost. After that, you will be redirected to the products page. Do you want to proceed?",
            "Yes", "Cancel",
        );

        mw['footer_btn_1'].addEventListener("click", function(){
            window.location.href = "products.html";
            return;
        });

        mw['footer_btn_2'].addEventListener("click", function(){
            util.removeSelf(mw['modal']);
            return;
        });

        return;
    });


    // submit
    // attach all photos 
    btn_submit.addEventListener("click", function(){
        if (status == PREVIEW){
            submit_for_edit_item(original_data);
        }
        else{
            submit_for_new_item();
        }
    });
}


// all inputs must be filled
// need at least one photo
function submit_for_new_item(){
    let div_edit = document.getElementsByClassName("edit")[0];

    let inputs = div_edit.querySelectorAll("input[type=text]");

    for (let i = 0; i < inputs.length; i++){
        if (inputs[i].value == ""){
            modal.create_simple_modal_with_text_and_close_feature(
                "New Item Submission Error",
                "Please fill all fields before submit.",
                "OK",
            );

            return;
        }
    }

    // also need at least one photo
    let all_img = div_edit.getElementsByTagName("img");

    if (all_img.length == 0){
        modal.create_simple_modal_with_text_and_close_feature(
            "New Item submission Error",
            "Please upload at least one photo before submit.",
            "OK",
        );

        return;
    }

    // now give a modal window for price and initial stock
    let mw = modal.create_complex_modal_with_text(
        "New Item Submission","", "Submit", "Close",
    );

    util.removeAllChild(mw['body']);

    mw['footer_btn_2'].addEventListener("click", function(){
        util.removeSelf(mw['modal']);
        return;
    });

    // add content into the body
    let row_1 = document.createElement("div");
    row_1.classList.add("row");

    let label_1 = document.createElement("label");
    label_1.textContent = "Please set initial price and stock number.";

    // price and stock
    let row_2 = document.createElement("div");
    row_2.classList.add("row");

    let label_2 = document.createElement("label");
    label_2.textContent = "Price";

    let input_price = document.createElement("input");
    input_price.placeholder = "Price";
    input_price.type = "text";

    let row_3 = document.createElement("div");
    row_3.classList.add("row");

    let label_3 = document.createElement("label");
    label_3.textContent = "Stock";

    let input_stock = document.createElement("input");
    input_stock.placeholder = "Stock";
    input_stock.type = "text";

    // link
    util.appendListChild(mw['body'], [row_1, row_2, row_3]);
    row_1.appendChild(label_1);
    util.appendListChild(row_2, [label_2, input_price]);
    util.appendListChild(row_3, [label_3, input_stock]);


    // click, check
    mw['footer_btn_1'].addEventListener("click", async function(){
        if (input_price.value == "" || input_stock.value == ""){
            modal.show_modal_input_error_and_redirect_back(
                mw['modal'], 
                "New Item Submission Error", 
                "Please fill both price and stock before submission.",
                "OK",
            );

            return;
        }

        let reg_price = /^\d+(\.\d{0,2})?$/;
        let reg_stock = /^\d+$/;

        if (! reg_price.test(input_price.value)){
            modal.show_modal_input_error_and_redirect_back(
                mw['modal'], 
                "New Item Submission Error", 
                "Please correct the price input before submission.",
                "OK",
            );

            return;
        }

        if (! reg_stock.test(input_stock.value)){
            modal.show_modal_input_error_and_redirect_back(
                mw['modal'], 
                "New Item Submission Error", 
                "Please correct the stock number input before submission.",
                "OK",
            );

            return;
        }

        
        // fill all data
        let new_data = {
            "price": input_price.value,
            "stock_number": input_stock.value,
            "photos": [],
        };
        
        for (let i = 0; i < inputs.length; i++){
            new_data[inputs[i].getAttribute("real_key")] = inputs[i].value;
        }

        for (let i = 0; i < all_img.length; i++){
            new_data['photos'].push(all_img[i].src);
        };

        util.removeSelf(mw['modal']);

        // submit
        let url = "http://localhost:5000/item";

        let init = {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `token ${sessionStorage.getItem("token")}`,
            },
            body: JSON.stringify(new_data),
        };

        try {
            let response = await fetch(url, init);

            if (! response.ok){
                let text = await response.text();
                throw Error(text);
            }

            let data = await response.json();
            
            let mw2 = modal.create_simple_modal_with_text(
                "New Item Submission Success",
                "You have successfully uploaded a new item. The customer can view and purchase now. Redirecting to the item page.",
                "OK",
            );

            mw2['footer_btn'].addEventListener("click", function(){
                window.location.href = `item.html?item_id=${data['item_id']}`;
                return;
            });
            
            return;
        }
        catch(err){
            alert("error");
            console.log(err);
        }
    });

    return;
}


// get all changed inputs
// also get all photos
function submit_for_edit_item(original_data){
    let div_edit = document.getElementsByClassName("edit")[0];

    // itm_id = -1 for status = NEW
    let item_id = div_edit.getAttribute("item_id");

    // check if there is any change
    // change include changes in photo, and changes in text
    let all_img = div_edit.getElementsByTagName("img");
    let new_photos = [];

    for (let i = 0; i < all_img.length; i++){
        new_photos.push(all_img[i].src);
    }
    
    let changed_inputs = div_edit.querySelectorAll("input[is_changed=true]");
    
    // no changes at all
    if (changed_inputs.length == 0 && JSON.stringify(new_photos) == JSON.stringify(original_data['photos'])){
        modal.create_simple_modal_with_text_and_close_feature(
            "Submit Error",
            "Please edit before submission.",
            "OK",
        );

        return;
    }

    // submit change
    let mw = modal.create_complex_modal_with_text(
        "Submit Confirmation", "", "Confirm", "Cancel"
    );

    mw['footer_btn_2'].addEventListener("click", function(){
        util.removeSelf(mw['modal']);
        return;
    });

    util.removeAllChild(mw['body']);
    
    // confirmation of all changes
    let row_1 = document.createElement("div");
    row_1.classList.add("row");
    mw['body'].appendChild(row_1);

    let label_1 = document.createElement("label");
    label_1.textContent = "Please double check these text changes. ";
    label_1.textContent += "All changes in the photos will also be sent to the database. Press confirm to proceed.";
    row_1.appendChild(label_1);

    for (let i = 0; i < changed_inputs.length; i++){
        let input = changed_inputs[i];

        let row_2 = document.createElement("div");
        row_2.classList.add("row");

        let label_2 = document.createElement("label");
        label_2.textContent = `${input.getAttribute("display_key")}: ${input.getAttribute("original_value")}  =>  ${input.value}`;

        // link
        mw['body'].appendChild(row_2);
        row_2.appendChild(label_2);
    }

    
    // submit !!!
    mw['footer_btn_1'].addEventListener("click", async function(){
        // new data has all changes, and all photos
        let new_data = {};
        
        for (let i = 0; i < changed_inputs.length; i++){
            new_data[changed_inputs[i].getAttribute("real_key")] = changed_inputs[i].value;
        }

        // also include changes in the photo
        if (JSON.stringify(new_photos) !== JSON.stringify(original_data['photos'])){
            new_data['photos'] = new_photos;
        }

        console.log(new_data);

        // turn off currrent modal window
        util.removeSelf(mw['modal']);


        let url = `http://localhost:5000/item/${item_id}`;

        let init = {
            method: 'PUT',
            headers: {
                'Authorization': `token ${sessionStorage.getItem("token")}`,
                'accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(new_data),
        };

        try {
            let response = await fetch(url, init);

            if (response.ok){
                let mw2 = modal.create_simple_modal_with_text(
                    "Edit Specification Successful",
                    "You have successfully editted the specs. These edits come into effect now. Redirecting you to the item page.",
                    "OK",
                );

                mw2['footer_btn'].addEventListener("click", function(){
                    window.location.href = `item.html?item_id=${item_id}`;
                    return;
                })
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
        catch(err) {
            alert("error");
            console.log(err);
        }
    });
    
    return;
}


// orignal_data: the data fetched from the backend
// when some input is changed, replace the data with the original ones
function assign_change_event_listener_to_inputs(original_data, status){
    let div_edit = document.getElementsByClassName("edit")[0];
    let inputs = div_edit.querySelectorAll("input[type=text]");

    for (let i = 0; i < inputs.length; i++){
        inputs[i].addEventListener("change", function(){
            inputs[i].setAttribute("is_changed", true);

            // now get all changed inputs
            let changed_inputs = div_edit.querySelectorAll("input[is_changed=true]");

            for (let j = 0; j < changed_inputs.length; j++){
                changed_inputs[j].classList.add("modified");
            }

            // display the preview
            let new_data = get_new_data_from_edit(original_data);
            put_item_on_page(new_data, status, original_data);
        });
    }
}


function get_new_data_from_edit(original_data){
    // deep copy
    let new_data = JSON.parse(JSON.stringify(original_data));

    // now get all changed inputs
    let div_edit = document.getElementsByClassName("edit")[0];
    let changed_inputs = div_edit.querySelectorAll("input[is_changed=true]");

    for (let j = 0; j < changed_inputs.length; j++){
        let key = changed_inputs[j].getAttribute("real_key");
        let new_value = changed_inputs[j].value;

        if (key in new_data['simple']){
            new_data['simple'][key] = new_value;
        }
        else{
            new_data['detail'][key] = new_value;
        }
    }

    // also check the photos
    let img_list = div_edit.getElementsByTagName("img");
    let src_list = [];

    for (let i = 0; i < img_list.length; i++){
        src_list.push(img_list[i].src);
    }

    delete new_data['photos'];
    new_data['photos'] = src_list;

    return new_data;
}


function fill_edit_with_data(original_data, div_edit, merged_data, specs_data_list, status){
    util.removeAllChild(div_edit);

    // add the item_id
    div_edit.setAttribute("item_id", merged_data['item_id']);

    // add a header
    let edit_header = document.createElement("h1");
    div_edit.appendChild(edit_header);

    if (status === NEW){
        edit_header.textContent = "Upload New Item Specification";
    }
    else {
        edit_header.textContent = "Edit Specification, Preview and Submit";
    }

    // a div for specs (top div)
    let div_specs = document.createElement("div");
    div_specs.classList.add("specs");
    div_edit.appendChild(div_specs);


    for (let i = 0; i < specs_data_list.length; i++){
        let div = document.createElement("div");
        div.classList.add("spec");
        div_specs.appendChild(div);

        // header
        let title = document.createElement("div");
        title.classList.add("spec-title");
        title.textContent = specs_data_list[i]['title'];
        div.appendChild(title);

        // a table
        let table = document.createElement("table");
        div.appendChild(table);

        // all specs
        for (let key in specs_data_list[i]['specs']){
            let value = merged_data[specs_data_list[i]['specs'][key]];

            let tr = table.insertRow(-1);

            let td_1 = tr.insertCell(-1);
            td_1.textContent = key;

            // second cell has an input
            let td_2 = tr.insertCell(-1);

            let input = document.createElement("input");
            input.type = "text";
            input.value = value;

            input.setAttribute("is_changed", false);
            input.setAttribute("display_key", key);
            input.setAttribute("original_value", value);
            input.setAttribute("real_key", specs_data_list[i]['specs'][key]);
            
            td_2.appendChild(input);
        }
    }


    // the last is for photos
    let div_photos = document.createElement("div");
    div_photos.classList.add("spec");
    div_specs.appendChild(div_photos);

    // header
    let photo_title = document.createElement("div");
    photo_title.classList.add("spec-title");
    photo_title.textContent = "Photos"; 

    let photo_body = document.createElement("div");
    photo_body.classList.add("photos")

    util.appendListChild(div_photos, [photo_title, photo_body]);

    original_data['photos'].forEach((src) => {
        let div = create_photo_section_in_edit(src, original_data);
        photo_body.appendChild(div);
    });

    // also a button to upload new photo
    add_new_photo_input(photo_body, original_data);

    return;
}


function create_photo_section_in_edit(src, original_data){
    // each photo has 2 things: img and remove button
    let div = document.createElement("div");
    div.classList.add("photo");

    let img = document.createElement("img");
    img.src = src;
    img.alt = "Photo";

    let btn_remove = document.createElement("button");
    btn_remove.textContent = "Remove";

    // link
    util.appendListChild(div, [img, btn_remove]);

    // remove function
    btn_remove.addEventListener("click", function(){
        // check how many images left
        // cannot remove the last one
        let count = div.parentNode.getElementsByTagName("img").length;

        if (count == 1){
            modal.create_simple_modal_with_text_and_close_feature(
                "Remove Photo Error",
                "The item must have one photo. Try to upload a new one before remove this last photo.",
                "OK",
            )

            return;
        }

        let mw = modal.create_complex_modal_with_text(
            "Remove Photo Confirmation",
            "Are you sure to remove this photo? You may keep a copy first.",
            "Remove", "Close",
        );

        mw['footer_btn_1'].addEventListener("click", function(){
            util.removeSelf(div);
            util.removeSelf(mw['modal']);

            // update the preview
            let new_data = get_new_data_from_edit(original_data);
            put_item_on_page(new_data, NEW, original_data);

            return;
        });

        mw['footer_btn_2'].addEventListener("click", function(){
            util.removeSelf(mw['modal']);
            return;
        })
    });

    return div;
}


function add_new_photo_input(div_parent, original_data){
    let div = document.createElement("div");
    div.classList.add("photo");
    div_parent.appendChild(div);

    let input = document.createElement("input");
    input.type = "file";
    input.textContent = "Upload New Photo";
    div.appendChild(input);

    input.addEventListener("change", function(){
        let file = input.files[0];

        let validFileTypes = ['image/png', 'image/jpg', 'image/jpeg'];
        let valid = validFileTypes.find(type => type === file.type);

        // Bad data, let's walk away.
        if (! valid) {
            modal.create_simple_modal_with_text_and_close_feature(
                "Image File Type Error",
                "Sorry. The website only supports png, jpg and jpeg at this moment ..",
                "OK",
            );

            // reset
            input.value = "";
            return;
        }

        // now decode this file use the promise
        // then add a new photo section before the input
        // and clear the input
        util.fileToDataUrl(file)
            .then((img_url) => {
                let new_div = create_photo_section_in_edit(img_url, original_data);
                div_parent.insertBefore(new_div, div);
                input.value = "";

                // call the update
                // update the preview
                let new_data = get_new_data_from_edit(original_data);
                put_item_on_page(new_data, NEW, original_data);

            })
            .catch((err) => {
                console.log(err);

                modal.create_simple_modal_with_text_and_close_feature(
                    "Upload Photo Error",
                    "Sorry. Something wrong with our website and your photo cannot be decoded properly. Please try another one..",
                    "OK",
                );
            })
        ;
    });

    return;
}


function provide_specs_list_for_edit(){
    // 6 lists: processor, graphic card, memory, display, storage, miscellaneous
    // and also the admin can edit the name
    // price and stock cannot be editted at here, only at the products.html interface

    // the data is merged using both 'detail' and 'simple'

    // for each spec: the key is for the label name

    let main = {
        "title": "Main",
        "specs": {
            "Item Name": "name",
        }
    };

    let cpu = {
        'title': "Processor",
        'specs': {
            'CPU Manufacturer (Intel / AMD)': 'cpu_prod', 
            'Model Name': 'cpu_model',
            'Lithography (nm)': 'cpu_lithography',
            'Cache (MB)': 'cpu_cache',
            'Base Speed (MHz)': 'cpu_base_speed',
            'Boost Speed (MHz)':'cpu_boost_speed',
            'Number of Processor Cores':'cpu_cores',
            'TDP (w)': 'cpu_tdp'
        },
    };
    
    let gpu = {
        'title': 'Graphic Card',
        'specs': {
            'GPU Manufacture (Nvidia / AMD / Intel)': 'gpu_prod',
            'Modal Name': 'gpu_model',
            'Architecture': 'gpu_architecture',
            'Lithography (nm)': 'gpu_lithography',
            'Base Speed (MHz)': 'gpu_base_speed',
            'Boost Speed (MHz)': 'gpu_boost_speed',
            'Memory Speed (MHz)': 'gpu_memory_speed',
            'Memory Bandwidth (bit)': 'gpu_memory_bandwidth',
            'Memory Size (MB)': 'gpu_memory_size',
            'TDP (w)': 'gpu_tdp',
        },
    };
    
    let memory = {
        'title': "Memory",
        'specs': {
            'Size (GB)': 'memory_size',
            'Speed (MHz)': 'memory_speed',
            'Type (DDR3 / DDR4 / DDR5)': 'memory_type',
        },
    };
    
    let display = {
        'title': "Display",
        'specs': {
            'Type (LED / LCD / IPS / Other)': 'display_type',
            'Screen Size (inch)': 'display_size',
            'Horizontal Resolution (px)': 'display_horizontal_resolution',
            'Vertical Resolution (px)': 'display_vertical_resolution',
            'Touch Screen? (yes / no)': 'display_touch',
        },
    };
    
    // ignore the secondary storage
    let storage = {
        'title': 'Storage',
        'specs': {
            'Model (SATA SSD / M.2. SSD / HDD)': 'primary_storage_model',
            'Size (GB)': 'primary_storage_cap',
            'Read Speed (MB/s)': 'primary_storage_read_speed',
        }
    }
    
    let other = {
        'title': 'Miscellaneous',
        'specs': {
            'Operating System (WIN10 / MacOS / Other)': 'operating_system',
            'Wireless Card Modal': 'wireless_card_model',
            'Wireless Card Speed (Mbps)': 'wireless_card_speed',
            'Warranty Years (1 / 2 / 3)': 'warranty_years',
            'Warranty Type (Standard Pick-up & Return / Onsite Repair / Other)': 'warranty_type_long',
            'Chassis Width (cm)': 'chassis_width_cm',
            'Chassis Depth (cm)': 'chassis_depth_cm',
            'Chassis Height (cm)': 'chassis_height_cm',
            'Chassis Weight (kg)': 'chassis_weight_kg',
            'Battery Capacity (Wh, watts per hour)': 'battery_capacity',
        },
    };

    return [main, memory, display, storage, cpu, gpu, other];
    //return [main, cpu, gpu, memory, display, storage, other];
}


// status = PURCHASE, SNAPSHOT, PREVIEW
function put_item_on_page(data, status, original_data){
    // item div, set either the real item_id, or -1
    let item = document.getElementsByClassName("item")[0];
    item.setAttribute("item_id", data['simple']['item_id']);


    // if snapshot, give a background image showing: This is purchase snapshot
    if (status == SNAPSHOT){
        item.classList.add("snapshot");
    }
    else if (status == PREVIEW){
        item.classList.add("preview");
    }
    else if (status == NEW){
        item.classList.add("new");
    }

    // simple: photo and a profile
    // detail: speicifications
    let div_simple = item.getElementsByClassName("simple")[0];
    let div_detail = item.getElementsByClassName("detail")[0];

    util.removeAllChild(div_simple);
    util.removeAllChild(div_detail);


    // simple profile consists of two main parts
    // the image on the left, and the short introduction on the left
    let simple_left = document.createElement("div");
    simple_left.classList.add("photos");

    let simple_right = document.createElement("div");
    simple_right.classList.add("simple-profile");

    util.appendListChild(div_simple, [simple_left, simple_right]);


    // left: 4 images
    put_photos(data['photos'], simple_left);
    put_profile(data, simple_right, status, original_data);

    // for detail: provide specifications. 
    put_specification(data, div_detail, status, original_data);

    return;
}


function put_specification(data, div, status, original_data){
    // give a header
    let header = document.createElement("div");
    header.classList.add("header");
    
    // give a body
    let specs = document.createElement("div");
    specs.classList.add("specs");

    // link header and body
    util.appendListChild(div, [header, specs]);

    // header incudes: title
    //    for admin: also has two buttons: delete / re-create, edti
    let title = document.createElement("div");
    title.classList.add("title");
    title.textContent = "Technical Specification";
    header.appendChild(title);
       
    // summary the data we need to build
    let specs_data_list = arrange_data_to_specs(data);

    let old_specs_data_list = null;
    if (status == PREVIEW || status == NEW){
        old_specs_data_list = arrange_data_to_specs(original_data);
    }

    for (let i = 0; i < specs_data_list.length; i++){
        let spec = null;

        if (status == PREVIEW || status == NEW){
            spec = create_table_with_input(specs_data_list[i], status, old_specs_data_list[i]);
        }
        else {
            spec = create_table_with_input(specs_data_list[i]);
        }

        specs.append(spec);
    }

    return;
}


function arrange_data_to_specs(data){
    // the table: several sections: 
    //      processor, memory, video card, display, storage
    //      (chassis, wireless card, battery, os, warranty)
    let d = data['detail'];

    // key value pair:
    //      each value is a list:
    //      the first value in list = value to display
    //      second value is also a dict: they are the original attribute names and the original value

    let data_table_cpu = {
        'title': "Processor",
        'specs': {
            'Model': `${d['cpu_prod']} ${d['cpu_model']}`,
            'Technology': `${d['cpu_lithography']} nm`,
            'Cache': `${d['cpu_cache']} MB`,
            'Base Speed': `${d['cpu_base_speed']} GHz`,
            'Max Speed': `${d['cpu_boost_speed']} GHz`,
            'Number of Cores': `${d['cpu_cores']}`,
            'TDP': `${d['cpu_tdp']} W`,
        },
    };

    let data_table_gpu = {
        'title': 'Graphic Card',
        'specs': {
            'Model': `${d['gpu_prod']} ${d['gpu_model']}`,
            'Architecture': `${d['gpu_architecture']}`,
            'Technology': `${d['gpu_lithography']} nm`,
            'Base Speed': `${d['gpu_base_speed']} MHz`,
            "Boost Speed": `${d['gpu_boost_speed']} MHz`,
            'Memory Speed': `${d['gpu_memory_speed']} MHz`,
            "Memory Bandwidth": `${d['gpu_memory_bandwidth']} bit`,
            "Memory Size": `${d['gpu_memory_size']} MB`,
            "TDP": `${d['gpu_tdp']} W`,
        },
    };

    let data_table_memory = {
        'title': "Memory",
        'specs': {
            'Memory Size': `${d['memory_size']} GB`,
            'Memory Speed': `${d['memory_speed']} MHz`,
            'Memory Type': `${d['memory_type']}`,
        },
    };

    let data_table_display = {
        'title': "Display",
        'specs': {
            'Model': `${d['display_type']}`,
            'Size': `${d['display_size']} Inch`,
            'Resolution': `${d['display_horizontal_resolution']} × ${d['display_vertical_resolution']}`,
            'Touch Screen': d['display_touch'] ? `${d['display_touch'].toUpperCase()}` : "NULL",
        },
    };
    
    // ignore the secondary storage
    let data_table_storage = {
        'title': 'Storage',
        'specs': {
            'Model': `${d['primary_storage_model']}`,
            'Size': `${d['primary_storage_cap']} GB`,
            'Read Speed': `${d['primary_storage_read_speed']} MB/s`,
        }
    }
    
    let data_table_other = {
        'title': 'Miscellaneous',
        'specs': {
            'Operating System': `${d['operating_system']}`,
            'WiFi Card': `${d['wireless_card_model']}`,
            'WiFi Speed': `${d['wireless_card_speed']} Mbps`,
            'Warranty': `${d['warranty_years']} Years ${d['warranty_type_long']}`,
            'Dimension (W cm x D cm x H cm)': `${d['chassis_width_cm']} × ${d['chassis_depth_cm']} × ${d['chassis_height_cm']}`,
            'Weight': `${d['chassis_weight_kg']} kg`,
            'Battery Capacity': `${d['battery_capacity']} WHr`,
        },
    };


    let specs_data_list = [
        data_table_cpu, data_table_gpu,
        data_table_memory, data_table_display,
        data_table_storage, data_table_other
    ];

    return specs_data_list;    
}


function create_table_with_input(data, status, original_data){
    let div = document.createElement("div");
    div.classList.add("spec");

    let title = document.createElement("div");
    title.textContent = data['title'];
    title.classList.add("spec-title");

    let table = document.createElement("table");
    
    util.appendListChild(div, [title, table]);

    // fill the table
    for (let key in data['specs']){
        // there are two values in the values_list
        // first element is the display value
        // second element is the dict {original_key : original_vlaue}
        let value = data['specs'][key];

        let tr = table.insertRow(-1);
        
        let td1 = tr.insertCell(-1);
        td1.textContent = key;

        let td2 = tr.insertCell(-1);
        td2.textContent = value == null ? "N.A." : value;

        // preview mode & new item mode
        if (status == PREVIEW || status == NEW){
            let old_value = original_data['specs'][key];
            let old_text = old_value == null ? "N.A." : old_value;

            if (td2.textContent !== old_text){
                tr.classList.add("modified");
            }
        }

        // link
        table.appendChild(tr);
        util.appendListChild(tr, [td1, td2]);
    }

    return div;
}


function put_photos(photos, div){
    let img = document.createElement("img");
    img.alt = "No image available..";
    div.appendChild(img);

    if (photos.length != 0){
        img.src = photos[0];
        img.setAttribute("photo_id", 0);

        // add left and right arrow
        let arrows = document.createElement("div");
        arrows.classList.add("arrows");
        div.appendChild(arrows);

        let img_left = document.createElement("i");
        img_left.classList.add("arrow-left");
        img_left.classList.add("material-icons");
        img_left.textContent = "keyboard_arrow_left";

        let img_right = document.createElement("i");
        img_right.classList.add("arrow-right")
        img_right.classList.add("material-icons");
        img_right.textContent = "keyboard_arrow_right";

        util.appendListChild(arrows, [img_left, img_right]);

        img_left.addEventListener("click", function(){
            let photo_id = parseInt(img.getAttribute("photo_id"));

            let next_photo_id = photo_id - 1;
            if (next_photo_id < 0){
                next_photo_id += photos.length;
            }

            img.src = photos[next_photo_id];
            img.setAttribute("photo_id", next_photo_id);

            return;
        })

        img_right.addEventListener("click", function(){
            let photo_id = parseInt(img.getAttribute("photo_id"));
            
            let next_photo_id = photo_id + 1;

            if (next_photo_id >= photos.length){
                next_photo_id -= photos.length;
            }

            img.src = photos[next_photo_id];
            img.setAttribute("photo_id", next_photo_id);

            return;
        })
    }

    return;
}


function put_profile(data, div, status, original_data){
    // right: small profile
    let name = document.createElement("div");
    name.classList.add("name");
    name.textContent = data['simple']['name'] ? data['simple']['name'] : "Null";

    if ((status == PREVIEW || status == NEW) && data['simple']['name'] !== original_data['simple']['name']){
        name.classList.add("modified");
    }

    // price cannot change under preview
    let price = document.createElement("div");
    price.classList.add("price");
    price.textContent = `$ ${data['simple']['price']}`;
    
    if ((status == PREVIEW || status == NEW) && data['simple']['price'] !== original_data['simple']['price']){
        price.classList.add("modified");
    }

    let list = document.createElement("ul");
    list.classList.add("list");

    // link
    util.appendListChild(div, [name, price, list]);

    // fill the list with texts
    let li_texts = create_texts_for_simple_profile(data);

    // total 5 li tag in the list
    for (let i = 0; i < li_texts.length; i++){
        let li = document.createElement("li");
        li.textContent = li_texts[i];
        list.appendChild(li);
    }

    let li_list = list.childNodes;
    

    // for admin preview, add "modified" class to editted data
    if (status == PREVIEW || status == NEW){
        // reconstruct all the 5 sentences, then check
        let old_texts = create_texts_for_simple_profile(original_data);

        for (let i = 0; i < li_texts.length; i++){
            if (old_texts[i] !== li_texts[i]){
                li_list[i].classList.add("modified");
            }
        }
    }


    // for customer, add the "purchase button"
    // for non-registered user, still display the button, but give login request when clicked
    if (status == PURCHASE){
        if (sessionStorage.getItem("role") == 1 || sessionStorage.getItem("role") == null){
            let purchase = document.createElement("button");
            purchase.classList.add("add-to-cart");
            purchase.setAttribute("item_id", data['simple']['item_id']);
        
            if (util_cart.isItemInCart(data['simple']['item_id'])){
                purchase.textContent = "Added To Cart";
                purchase.classList.add("in-cart");
            }
            else{
                purchase.textContent = "Add To Cart";
            }
    
            // purchase onclick
            purchase.addEventListener("click", function(){
                // if not logged in, display modal window to ask
                if (sessionStorage.getItem("role") == null){
                    let mw = modal.create_complex_modal_with_text(
                        "Purchase Error",
                        "Dear customer. Please log in before adding item to your cart.",
                        "Log In",
                        "Close",
                    );
    
                    mw['footer_btn_1'].addEventListener("click", function(){
                        window.location.href = "login.html";
                        return;
                    });
    
                    mw['footer_btn_2'].addEventListener("click", function(){
                        util.removeSelf(mw['modal']);
                        return;
                    });
    
                    return;
                }
    
    
                // for customer
                if (purchase.classList.contains("in-cart")){
                    // already in cart
                    let mw = modal.create_complex_modal_with_text(
                        "Item Already In Cart",
                        "Dear Customer. The item is in your cart already.",
                        "View Cart", 
                        "Close",
                    );
    
                    mw['footer_btn_1'].addEventListener("click", function(){
                        window.location.href = "checkout.html";
                        return;
                    })
    
                    mw['footer_btn_2'].addEventListener("click", function(){
                        util.removeSelf(mw['modal']);
                        return;
                    })
    
                    return;
                }
    
                // add to cart
                util_cart.addToCart(
                    data['simple']['item_id'], 
                    data['simple']['name'], 
                    data['photos'][0],
                    data['simple']['price'],
                );
    
                purchase.classList.add("in-cart");
                purchase.textContent = "Added To Cart";
    
                return;
            });
    
            div.appendChild(purchase);
        }
    }
    else if (status == SNAPSHOT) {
        // for snapshot, give a button taking the customer to the item on sale
        let view = document.createElement("button");
        view.textContent = "View The Current Profile";

        view.addEventListener("click", function(){
            let search = new URLSearchParams(window.location.search.substring(1));
            search.delete("type");

            let new_url = `item.html?${search.toString()}`;
            window.location.href = new_url;
            return;
        })

        div.appendChild(view);
    }


    return;
}


function create_texts_for_simple_profile(data){
    // display
    let t1 = `${data['detail']['display_size']}\" ${data['detail']['display_horizontal_resolution']} × ${data['detail']['display_vertical_resolution']} screen`;

    // cpu
    let t2 = `${data['detail']['cpu_prod']} ${data['detail']['cpu_model']} boost up to ${data['detail']['cpu_boost_speed']} GHz`;

    // gpu
    let t3 = `${data['detail']['gpu_prod']} ${data['detail']['gpu_model']}`

    // memory
    let t4 = `${data['detail']['memory_size']} GB ${data['detail']['memory_type']} ${data['detail']['memory_speed']} MHz`;

    // storage
    let t5 = `${data['detail']['primary_storage_cap']} GB ${data['detail']['primary_storage_model']}`;
    
    return [t1, t2, t3, t4, t5];
}



