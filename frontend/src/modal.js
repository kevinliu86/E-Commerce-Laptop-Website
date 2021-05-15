import * as util from './util.js';


function create_simple_modal(){
    let main = document.getElementsByTagName("main")[0];

    let modal = document.createElement('div');
    modal.classList.add("modal");
    main.insertBefore(modal, main.firstChild);

    // content
    let content = document.createElement("div");
    content.classList.add("modal-content");
    modal.appendChild(content);

    // content: header, body, footer
    let header = document.createElement("div");
    header.classList.add("header");

    let body = document.createElement("div");
    body.classList.add("body");

    let footer = document.createElement("div");
    footer.classList.add("footer");
    
    util.appendListChild(content, [header, body, footer]);

    // header has a place to put a title
    let header_txt = document.createElement("div");
    header_txt.classList.add("header-title");
    header.appendChild(header_txt);

    // body also has a place to put txt
    let body_txt = document.createElement("div");
    body_txt.classList.add("p");
    body.appendChild(body_txt);

    // footer: simple modal: close button
    let btn = document.createElement("button");
    btn.type = "button";
    footer.appendChild(btn);

    // return a dictionary: easier to update
    let result = {
        'modal': modal,
        'title': header_txt,
        'body': body,
        'body_text': body_txt,
        'footer': footer,
        'footer_btn': btn
    };

    return result;
}


function create_modal_with_two_btns(){
    let modal_dict = create_simple_modal();

    // add a button
    let btn2 = document.createElement("button");
    btn2.type = "button";
    modal_dict['footer'].appendChild(btn2);

    // re-organize the dict
    modal_dict['footer_btn_1'] = modal_dict['footer_btn'];
    modal_dict['footer_btn_2'] = btn2;
    delete modal_dict['footer_btn'];

    return modal_dict;
}


export function create_simple_modal_with_text(title_text, body_text, btn_text){
    let modal_dict = create_simple_modal();

    modal_dict['title'].textContent = title_text;
    modal_dict['body_text'].textContent = body_text;
    modal_dict['footer_btn'].textContent = btn_text;

    return modal_dict;
}


export function create_simple_modal_with_text_and_close_feature(title_text, body_text, btn_text){
    let modal_dict = create_simple_modal_with_text(title_text, body_text, btn_text);
    modal_dict['footer_btn'].addEventListener("click", function(){
        util.removeSelf(modal_dict['modal']);
        return;
    });

    return;
}


export function create_complex_modal_with_text(title_text, body_text, btn_1_text, btn_2_text){
    let modal_dict = create_modal_with_two_btns();

    modal_dict['title'].textContent = title_text;
    modal_dict['body_text'].textContent = body_text;
    modal_dict['footer_btn_1'].textContent = btn_1_text;    
    modal_dict['footer_btn_2'].textContent = btn_2_text; 

    return modal_dict;
}


export function create_force_logout_modal(){
    let modal_dict = create_simple_modal_with_text(
        "Authentication Error",
        "Sorry. Something wrong with the authentication. Please log in again..",
        "OK",
    );

    modal_dict['footer_btn'].addEventListener("click", function(){
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "login.html";
        return;
    });

    return;
}


export function show_modal_input_error_and_redirect_back(current_mw, title_text, body_text, btn_text){
    current_mw.style.display = "none";

    let new_mw = create_simple_modal_with_text(
        title_text, body_text, btn_text
    );

    new_mw['footer_btn'].addEventListener("click", function(){
        util.removeSelf(new_mw['modal']);
        current_mw.style.display = "block";
        return;
    });

    return;
}

