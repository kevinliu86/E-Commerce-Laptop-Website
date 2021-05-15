import * as util from "./util.js";


// display the item, provide a "div" called "products", and the data
// put all div called "product" onto the given div 
export function put_products_on_shelf(products, data){
    util.removeAllChild(products);

    // add each product
    for (let i = 0; i < data.length; i++){
        let product = document.createElement("div");
        product.classList.add("product");
        product.setAttribute("item_id", data[i]['simple']['item_id']);
        products.appendChild(product);

        // for the flip effect, add another div wrapper
        let inner = document.createElement("div");
        inner.classList.add("inner");
        product.appendChild(inner);

        // there are two sides of each product: front - back 
        // back is a table
        // initially "back" does not show
        let front = document.createElement("div");
        front.classList.add("front");
        
        let back = document.createElement("table");
        back.classList.add("back");

        util.appendListChild(inner, [front, back]);


        // front size shows name, launch date, img, price, cart icon
        let front_name = document.createElement("div");
        front_name.classList.add("name");
        front_name.textContent = data[i]['simple']['name'];

        let front_attr = document.createElement("div");
        front_attr.classList.add("stickers");
        fill_front_attributes(front_attr, data[i]);

        let front_img = document.createElement("img");
        front_img.src = data[i]['simple']['thumbnail'];
        front_img.alt = "Image not available for now";

        let front_price = document.createElement("div");
        front_price.classList.add("price");
        front_price.textContent = "$ " + data[i]['simple']['price'];

        util.appendListChild(front,[
            front_name, front_attr, front_img, front_price
        ]);

        
        // back side: name, display, cpu model, graphic card, ram amount, ssd amount
        // the first row will create a <th> tag
        // other row simple a <td> tag
        let td_lists = []

        for (let i = 0; i < 6; i++){
            let tr = back.insertRow(-1);

            if (i == 0){
                let th = document.createElement("th");
                tr.appendChild(th);
                td_lists.push(th);
            }
            else {
                let td = tr.insertCell(-1);
                td_lists.push(td);
            }
        }

        // so total 6 textContents need to be assign
        td_lists[0].textContent = `${data[i]['simple']['name']}`;

        td_lists[1].textContent = `${data[i]['detail']['display_size']} inch 
            ${data[i]['detail']['display_horizontal_resolution']} × ${data[i]['detail']['display_vertical_resolution']}`
        ;

        td_lists[2].textContent = `${data[i]['detail']['cpu_prod']} ${data[i]['detail']['cpu_model']}`;

        td_lists[3].textContent = `${data[i]['detail']['gpu_prod']} ${data[i]['detail']['gpu_model']}`;

        td_lists[4].textContent = `${data[i]['detail']['memory_size']} GB RAM ${data[i]['detail']['memory_type']}`;

        td_lists[5].textContent = `${data[i]['detail']['primary_storage_cap']} GB Storage`;
       

        // event listener
        product.addEventListener("click", function(){
            window.location.href = "item.html" + "?item_id=" + product.getAttribute("item_id");
            return;
        })
    }
}


// create 4 small sticker onto the post
// example: 13.3" 4300U 8GB 128GB
// display some elementary information including screen size, cpu, ram, storage
function fill_front_attributes(div, item_data){
    for (let i = 0; i < 4; i++){
        let sticker = document.createElement("div");
        sticker.classList.add("sticker");
        div.appendChild(sticker);
    }

    // for the cpu, remove the PRO substring
    // so that the stickers will not become two lines

    div.childNodes[0].textContent = `${item_data['detail']['display_size']}"`;
    div.childNodes[1].textContent = `${item_data['detail']['cpu_model']}`;
    div.childNodes[2].textContent = `${item_data['detail']['memory_size']} GB`;
    div.childNodes[3].textContent = `${item_data['detail']['primary_storage_cap']} GB`;
}