import * as util from "./util.js";
import * as util_products from "./util_products.js";


export function getAllRecommenderDivs(){
    let recommender = document.getElementsByClassName("recommender")[0];

    // two without token
    let topselling = recommender.getElementsByClassName("topselling")[0];
    let topview = recommender.getElementsByClassName("topview")[0];

    // three with token
    let viewhistory = recommender.getElementsByClassName("viewhistory")[0];
    let byitem = recommender.getElementsByClassName("byitem")[0];
    let byviewhistory = recommender.getElementsByClassName("byviewhistory")[0];    

    return {
        'self': recommender,
        'topselling': topselling,
        'topview': topview,
        'viewhistory': viewhistory,
        'byitem': byitem,
        'byviewhistory': byviewhistory,
    };
}


export async function fill_view_history_or_recommender_with_token(div, keyword){
    util.removeAllChild(div);

    let div_dict = null;
    let url = null;

    if (keyword == "viewhistory"){
        div_dict = create_basic_format_for_recommender(div, "You Recently Viewed", false);
        url = "http://localhost:5000/user/viewhistory";
    }
    else if (keyword == "byitem"){
        div_dict = create_basic_format_for_recommender(div, "Guess You Like", false);
        url = "http://localhost:5000/recommender/item";
    }
    else if (keyword == "byviewhistory"){
        div_dict = create_basic_format_for_recommender(div, "Recommend based on your view history", false);
        url = "http://localhost:5000/recommender/viewhistory";
    }

    
    let init = {
        method: 'GET',
        headers: {
            'Authorization': `token ${sessionStorage.getItem("token")}`,
            'accpet': 'application/json',
        },
    };


    try {
        let response = await fetch(url, init);

        // three results: 200 => display content, 204 => no record, 500 => error
        if (response.status == 200){
            let data = await response.json();            
            util_products.put_products_on_shelf(div_dict.products, data);
            assign_sliding_dots(div_dict.products, div_dict.dots, keyword);
        }
        else if (response.status == 204){
            // display: no view history 
            if (keyword == "viewhistory"){
                let no_product = document.createElement("div");
                no_product.classList.add("recommender-nothing");
                no_product.textContent = "No view history available. Please visit the products page.";
                div_dict.products.appendChild(no_product);
            }
            else if (keyword == "byitem") {
                // for the byitem recommender, simply remove the whole section
                util.removeSelf(div);
            }
            else {
                // keyword == "byviewhistory"
                util.removeSelf(div);
            }
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


export async function fill_top_selling_or_top_view(div, is_top_selling){
    util.removeAllChild(div);

    let url = null;
    let div_dict = null;

    if (is_top_selling){
        div_dict = create_basic_format_for_recommender(div, "Best Selling", true);
        url = "http://localhost:5000/recommender/topselling";
    }
    else{
        div_dict = create_basic_format_for_recommender(div, "Most Viewed", true);
        url = "http://localhost:5000/recommender/topview";
    }


    // add the button onclick
    div_dict.refresh.addEventListener("click", function(){
        fill_top_selling_or_top_view(div, is_top_selling);
        return;
    });


    let init = {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
    };

    try {
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();
            util_products.put_products_on_shelf(div_dict.products, data);
            assign_sliding_dots(div_dict.products, div_dict.dots);
        }
        else{
            let text = await response.json();
            throw Error(text);
        }
    }
    catch(err){
        alert("error");
        console.log(err);
    }
}


function assign_sliding_dots(products, dots, keyword){
    // check how many products are there
    // if less than 4, then remove the dots
    let product_list = products.getElementsByClassName("product");

    // the page layout can display 4 items in a row without wrap
    if (product_list.length <= 4){
        util.removeSelf(dots);
        return;
    }

    // if more than 4 elements, assign the sliding
    let dot_list = dots.getElementsByClassName("dot");

    // this does not slide, when clicked, go to the next section
    for (let i = 0; i < dot_list.length; i++){
        dot_list[i].addEventListener("click", function(){
            // hide every things
            for (let j = 0; j < product_list.length; j++){
                product_list[j].classList.add("hide");
            }

            // remove "hide" class from i * 4 to (i+1) * 4
            for (let j = i * 4; j < (i+1) * 4 && j < product_list.length; j++){
                product_list[j].classList.remove("hide");
            }
        });
    }

    // default, click on the first set
    dot_list[0].click();

    return;
}


function create_basic_format_for_recommender(div, title_text, require_refresh){
    let title = document.createElement("div");
    title.classList.add("title");
    div.appendChild(title);

    // h1
    let h1 = document.createElement("h1");
    h1.textContent = title_text;
    title.appendChild(h1);

    let btn_refresh = null;

    if (require_refresh){
        btn_refresh = document.createElement("button");
        btn_refresh.textContent = "Refresh";
        title.appendChild(btn_refresh);
    }

    // div products
    let products = document.createElement("div");
    products.classList.add("products");
    div.appendChild(products);

    // two buttons
    let dots = document.createElement("div");
    dots.classList.add("dots");
    div.appendChild(dots);

    // default two dot
    for (let i = 0; i < 2; i++){
        let dot = document.createElement("dot");
        dot.classList.add("dot");
        dots.appendChild(dot);
    }

    
    // return a dictionary
    return {
        "self": div,
        "refresh": btn_refresh,
        "products": products,
        "dots": dots,
    };
}



