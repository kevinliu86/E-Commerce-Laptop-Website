import {navbar_set_up} from "./navbar.js"
import * as util from "./util.js";
import * as modal from "./modal.js";


util.addLoadEvent(navbar_set_up);
util.addLoadEvent(page_set_up);


async function page_set_up(){
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

    // get the table
    let table = document.getElementsByTagName("table")[0];

    let url = "http://localhost:5000/admin/users";
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
            display_all_customers(table, data);
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
}


function display_all_customers(table, data){
    let header = table.createTHead();
    let header_tr = header.insertRow(-1);
    
    let header_text_list = ["Customer ID", "Name", "Email", "Contact Number", "Details & Orders"];
    for (let i = 0; i < header_text_list.length; i++){
        let th = header_tr.insertCell(-1);
        th.textContent = header_text_list[i];
    }

    // body
    let body = table.createTBody();

    for (let i = 0; i < data.length; i++){
        let tr = body.insertRow(-1);

        for (let j = 0; j < header_text_list.length; j++){
            tr.insertCell(-1);
        }

        let td_list = tr.getElementsByTagName("td");

        // id
        td_list[0].textContent = `#${data[i]['user_id']}`;

        // name
        td_list[1].textContent = `${data[i]['first_name']} ${data[i]['last_name']}`;

        // email
        td_list[2].textContent = `${data[i]['email']}`;

        // mobile
        td_list[3].textContent = `${data[i]['mobile']}`;

        // last cell is a button to view details & orders
        let btn_view = document.createElement("button");
        btn_view.textContent = "View";
        td_list[4].appendChild(btn_view);

        btn_view.addEventListener("click",function(){
            window.location.href = `account.html?user_id=${data[i]['user_id']}`;
            return;
        });
    }
}

