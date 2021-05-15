import {navbar_set_up} from "./navbar.js";
import * as util from "./util.js";
import * as rec from "./recommender.js";


util.addLoadEvent(navbar_set_up);
util.addLoadEvent(page_set_up);


function page_set_up(){
    banner_set_up();
    recommenders_set_up();
    return;
}


async function banner_set_up(){
    let url = "http://localhost:5000/recommender/random";
    let init = {
        method: 'GET',
        headers: {
            'accpet': 'application/json',
        },
    };

    try {
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();
            display_banner(data);
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


function display_banner(data){
    let banners = document.getElementsByClassName("banners")[0];

    let dots = document.createElement("div");
    dots.classList.add("dots");


    // at beginning, all banner are hided, all dots are inactive
    for (let i = 0; i < data.length; i++){
        let banner = document.createElement("div");
        banner.classList.add("banner");
        banner.classList.add("hide");
        banners.appendChild(banner);

        // inside the banner, two things: image, h2 text
        let img = document.createElement("img");
        img.src = data[i]['photo'];

        let h2 = document.createElement("h2");
        h2.textContent = data[i]['name'];

        util.appendListChild(banner, [img, h2]);

        // click listender to the banner
        banner.addEventListener("click", function(){
            window.location.href = `item.html?item_id=${data[i]['item_id']}`;
            return;
        });

        // also the dots
        let dot = document.createElement("div");
        dot.classList.add("dot");
        dot.classList.add("inactive");
        dots.appendChild(dot);

        // click to move
        dot.addEventListener("click", function(){
            show_this_banner(i);
            return;
        });
    }


    // link the dots
    banners.appendChild(dots);

    // turn on the first one
    show_this_banner(0);

    // set auto move to next one
    set_up_animation();

    return;
}


function show_this_banner(id){
    let banners = document.getElementsByClassName("banners")[0];
    let dots = banners.getElementsByClassName("dots")[0];

    if (id >= dots.childNodes.length || id < 0){
        alert(`error input id for show_this_banner ${id}`);
        return;
    }

    let current_id = banners.getAttribute("current_id") ? parseInt(banners.getAttribute("current_id")) : null;

    // if there is a current id, then hide them
    if (current_id !== null){
        banners.childNodes[current_id].classList.add("hide");
        dots.childNodes[current_id].classList.add("inactive");
    }

    // turn on the next one
    banners.childNodes[id].classList.remove("hide");
    dots.childNodes[id].classList.remove("inactive");

    // set the current_id
    banners.setAttribute("current_id", id);

    return;
}


function set_up_animation(){
    let banners = document.getElementsByClassName("banners")[0];

    setInterval(function(){
        let id = parseInt(banners.getAttribute("current_id"));
        
        id += 1;
        id %= (banners.childNodes.length - 1);    // remove the dots div

        show_this_banner(id);
        return;
    }, 5000);

    return;
}


function recommenders_set_up(){
    let rec_dict = rec.getAllRecommenderDivs();

    if (sessionStorage.getItem("role") == 1){
        // require token
        rec.fill_view_history_or_recommender_with_token(rec_dict.viewhistory, "viewhistory");
        rec.fill_view_history_or_recommender_with_token(rec_dict.byitem, "byitem");
    }

    rec.fill_top_selling_or_top_view(rec_dict.topselling, true);
    rec.fill_top_selling_or_top_view(rec_dict.topview, false);

    return;
}

