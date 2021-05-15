import * as util from "./util.js";
import {navbar_set_up} from "./navbar.js";
import * as modal from "./modal.js";


util.addLoadEvent(navbar_set_up)


document.getElementById('submit-signin').addEventListener('click', async ()=>{
    let email = document.getElementById('email-signin').value;
    let password = document.getElementById('password-signin').value;

    if (email == "" || password == ""){
        alert("Please fill both fields. ");
        return;
    }

    let loginBody = {
        "email" : email,
        "password" : password
    }; 

    let url = "http://localhost:5000/auth/login";
    
    let init = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(loginBody)
    };

    try{
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();

            sessionStorage.setItem("token", data['token']);
            sessionStorage.setItem("role", data['role']);
            
            let mw = modal.create_simple_modal_with_text(
                "Login Success",
                "",
                "OK"
            );

            if (data['role'] == 1){
                mw['body_text'].textContent = "Welcome back customer !!";
            }
            else{
                mw['body_text'].textContent = "Welcome back admin !!";
            }

            mw['footer_btn'].addEventListener("click", function(){
                util.removeSelf(mw['modal']);
                window.location.href = "index.html";
                return;
            })

            return;
        }
        else if (response.status == 403){
            let mw = modal.create_simple_modal_with_text(
                "Login Fail",
                "Please double check your email and password..",
                "OK"
            );

            mw['footer_btn'].addEventListener("click", function(){
                util.removeSelf(mw['modal']);
                return;
            });

            return;
        }
    }
    catch (e){
        alert("error");
        console.log(e);
    }

    return;

});

