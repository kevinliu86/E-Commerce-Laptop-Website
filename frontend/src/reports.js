import {navbar_set_up} from "./navbar.js"
import * as util from "./util.js";
import * as modal from "./modal.js";


util.addLoadEvent(navbar_set_up);
util.addLoadEvent(page_set_up);


function page_set_up(){
    // only admin can access this page
    if (sessionStorage.getItem("role") !== "0"){
        let mw = modal.create_simple_modal_with_text(
            "No Access",
            "Sorry. You do not have access to this page. Redirecting you to the home page.",
            "OK",
        );

        mw['footer_btn'].addEventListener("click", function(){
            window.location.href = "index.html";
            return;
        });

        return;
    }

    let fields = document.getElementsByClassName("fields")[0];

    set_up_input_fields(fields);
    get_and_show_graphs(fields);
}


async function get_and_show_graphs(fields){
    // get all elements from the graph
    let input_from = fields.querySelector("input[name=from]");
    let input_to = fields.querySelector("input[name=to]");
    
    let radio = fields.querySelector("input[name=type]:checked");

    let url = `http://localhost:5000/sales?start=${input_from.value}&end=${input_to.value}&type=${radio.value}`;

    let init = {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'Authorization': `token ${sessionStorage.getItem("token")}`,
        },
    };

    try {
        let response = await fetch(url, init);

        if (response.ok){
            let data = await response.json();
            show_graphs(data);
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
}


function show_graphs(data){
    let div = document.getElementsByClassName("reports")[0];
    let simple = div.getElementsByClassName("simple")[0];
    let graphs = div.getElementsByClassName("graphs")[0];

    util.removeAllChild(simple);
    util.removeAllChild(graphs);

    // fill the simple first
    fill_cards(simple, data['orders'], data['turnover'], data['gst'], data['revenue']);

    draw_orders_bar_chart(graphs, data["graphs"]['orders'], data['type']);
    draw_item_bar_chart(graphs, data["graphs"]['items']);
    draw_customer_bar_chart(graphs, data["graphs"]['customers']);
    
    return;
}


function draw_customer_bar_chart(div, data){
    console.log(data);

    let margin = {
        top: 80, 
        right: 80, 
        bottom: 80, 
        left: 80
    };

    let width = 1600; 
    let height = 700;

    // append the svg object to the div
    let svg = d3.select(div)
        .append("svg")
            .attr("width", width)
            .attr("height", height)
    ;
    

    // x scale
    let x_scale = d3.scaleBand()  
        .range([ margin.left, width - margin.right ])
        .domain(data.map(d => d.name))
        .padding(0.2)
    ;
    
    // y scale left: scale to 1000
    let left_max = Math.max.apply(Math, data.map(d => d.total_price));
    let left_scale_max = ceil_to_scale(left_max, 1000);

    let y_left_scale = d3.scaleLinear()
        .domain([0, left_scale_max])
        .range([height - margin.bottom, margin.top])
    ;


    // define the axis
    let x_axis = d3.axisBottom(x_scale);
    let y_left_axis = d3.axisLeft(y_left_scale).ticks(5).tickFormat(d => d);


    // add x axis to graph
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(x_axis)
        .selectAll("text")
            .attr("text-anchor", "middle")
            .style("text-anchor", "center")
            .style("font-size", data.length < 10 ? "16px" : "12px")
    ;

    // left y axis
    svg.append('g')
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(y_left_axis)
        .style("font-size", "14px")
        .call(g => g.append("text")
            .attr("x", 0)
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .attr('fill', "black")
            .text("Amount")
            .style("font-size", "18px")
        )
    ;


    // add bars and data labels
    svg.selectAll("mybar")
        .data(data)
        .enter()
        .append("rect") 
            .attr("x", d => x_scale(d.name))
            .attr("y", d => y_left_scale(d.total_price))
            .attr("width", d => x_scale.bandwidth())
            .attr("height", d => height - margin.bottom - y_left_scale(d.total_price))
            .attr("fill", "#7FFFD4")
            .style("cursor", "pointer")
            .on("click", (d) => {
                window.location.href = `account.html?user_id=${d.user_id}`;
            })
    ;

    svg.selectAll("bar-labels")
        .data(data)
        .enter()
        .append("text")
            .attr("x", d => x_scale(d.name) + x_scale.bandwidth() / 2)
            .attr("y", d => y_left_scale(d.total_price) - 5)
            .attr("text-anchor", "middle")
            .attr("height", d => height - margin.bottom - y_left_scale(d.value))
            .text(d => d.total_price)
            .style("font-size", "14px")
    ;


    // add chart title
    svg.append("text")
        .attr("x", width / 2)             
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")  
        .style("font-weight", "bold")
        .style("font-size", "30px") 
        .text("Customer Purchase Summary (Click the bar to view customer profile)")
    ;

    // add x axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .text("Customer Name")
    ;

    return;
}



function draw_item_bar_chart(div, data){
    // console.log(data);

    let margin = {
        top: 80, 
        right: 80, 
        bottom: 140, 
        left: 80
    };

    let width = 1600; 
    let height = 700;

    // append the svg object to the div
    let svg = d3.select(div)
        .append("svg")
            .attr("width", width)
            .attr("height", height)
    ;
    

    // x scale
    let x_scale = d3.scaleBand()  
        .range([ margin.left, width - margin.right ])
        .domain(data.map(d => d.name))
        .padding(0.2)
    ;
    
    // y scale left: scale to 1000
    let left_max = Math.max.apply(Math, data.map(d => d.amount));
    let left_scale_max = ceil_to_scale(left_max, 5);

    let y_left_scale = d3.scaleLinear()
        .domain([0, left_scale_max])
        .range([height - margin.bottom, margin.top])
    ;


    // define the axis
    let x_axis = d3.axisBottom(x_scale);
    let y_left_axis = d3.axisLeft(y_left_scale).ticks(5).tickFormat(d => d);


    // add x axis to graph
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(x_axis)
        .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", data.length < 50 ? "14px" : "9px")
    ;

    // left y axis
    svg.append('g')
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(y_left_axis)
        .style("font-size", "14px")
        .call(g => g.append("text")
            .attr("x", 0)
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .attr('fill', "black")
            .text("Amount")
            .style("font-size", "18px")
        )
    ;


    // add bars and data labels
    svg.selectAll("mybar")
        .data(data)
        .enter()
        .append("rect") 
            .attr("x", d => x_scale(d.name))
            .attr("y", d => y_left_scale(d.amount))
            .attr("width", d => x_scale.bandwidth())
            .attr("height", d => height - margin.bottom - y_left_scale(d.amount))
            .attr("fill", "#7FFFD4")
            .style("cursor", "pointer")
            .on("click", (d) => {
                window.location.href = `item.html?item_id=${d.item_id}`;
            })
    ;

    svg.selectAll("bar-labels")
        .data(data)
        .enter()
        .append("text")
            .attr("x", d => x_scale(d.name) + x_scale.bandwidth() / 2)
            .attr("y", d => y_left_scale(d.amount) - 5)
            .attr("text-anchor", "middle")
            .attr("height", d => height - margin.bottom - y_left_scale(d.value))
            .text(d => d.amount)
            .style("font-size", "14px")
    ;


    // add chart title
    svg.append("text")
        .attr("x", width / 2)             
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")  
        .style("font-weight", "bold")
        .style("font-size", "30px") 
        .text("Sold Item Summary (Click the bar to view item profile)")
    ;

    // add x axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .text("Item Name")
    ;

    return;
}


function draw_orders_bar_chart(div, data, graph_type){
    let margin = {
        top: 80, 
        right: 80, 
        bottom: 80, 
        left: 80
    };

    let width = 1600; 
    let height = 700;

    // append the svg object to the div
    let svg = d3.select(div)
        .append("svg")
            .attr("width", width)
            .attr("height", height)
    ;
    

    // x scale
    let x_scale = d3.scaleBand()  
        .range([ margin.left, width - margin.right ])
        .domain(data.map(function(d) { return d.x; }))
        .padding(0.2)
    ;
    
    // y scale left: scale to 1000
    let left_max = Math.max.apply(Math, data.map(d => d.value));
    let left_scale_max = ceil_to_scale(left_max, 1000);

    let y_left_scale = d3.scaleLinear()
        .domain([0, left_scale_max])
        .range([height - margin.bottom, margin.top])
    ;

    // y scale right: scale to 5
    let right_max = Math.max.apply(Math, data.map(d => d.count));
    let right_scale_max = ceil_to_scale(right_max, 5);

    let y_right_scale = d3.scaleLinear()
        .domain([0, right_scale_max])
        .range([height - margin.bottom, margin.top])
    ;


    // define the axis
    let x_axis = d3.axisBottom(x_scale);
    let y_left_axis = d3.axisLeft(y_left_scale).ticks(5).tickFormat(d => `$ ${d}`);
    let y_right_axis = d3.axisRight(y_right_scale).ticks(5).tickFormat(d => d);


    // add x axis to graph
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(x_axis)
        .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", data.length < 50 ? "14px" : "9px")
    ;

    // left y axis
    svg.append('g')
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(y_left_axis)
        .style("font-size", "14px")
        .call(g => g.append("text")
            .attr("x", 0)
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .attr('fill', "black")
            .text("Turnover")
            .style("font-size", "18px")
        )
    ;

    // right y axis
    svg.append('g')
        .attr("transform", `translate(${width - margin.right}, 0)`)
        .call(y_right_axis)
        .style("font-size", "14px")
        .call(g => g.append("text")
            .attr("x", 0)
            .attr("y", margin.top - 10)
            .attr("text-anchor", "middle")
            .attr('fill', "black")
            .text("Order Number")
            .style("font-size", "18px")
        )
    ;


    // add bars and data labels
    svg.selectAll("mybar")
        .data(data)
        .enter()
        .append("rect") 
            .attr("x", d => x_scale(d.x))
            .attr("y", d => y_left_scale(d.value))
            .attr("width", d => x_scale.bandwidth())
            .attr("height", d => height - margin.bottom - y_left_scale(d.value))
            .attr("fill", "#7FFFD4")
    ;

    svg.selectAll("bar-labels")
        .data(data)
        .enter()
        .append("text")
            .attr("x", d => x_scale(d.x) + x_scale.bandwidth() / 2)
            .attr("y", d => y_left_scale(d.value) - 5)
            .attr("text-anchor", "middle")
            .attr("height", d => height - margin.bottom - y_left_scale(d.value))
            .text(d => d.value === 0 ? "" : `$ ${d.value}`)
            .style("font-size", "14px")
    ;


    // add the line plot and data label
    svg.append('path')
        .datum(data)
            .attr("d", d3.line()
                        .x((d, i) => x_scale(d.x) + x_scale.bandwidth() / 2)
                        .y((d, i) => y_right_scale(d.count)))
            .attr('fill','none')
            .attr('stroke', "#191970")
            .attr('stroke-width',1)
    ;

    svg.selectAll("line-labels")
        .data(data)
        .enter()
        .append("text")
            .attr("x", d => x_scale(d.x) + x_scale.bandwidth() / 2)
            .attr("y", d => y_right_scale(d.count) - 10)
            .attr("text-anchor", "middle")
            .text(d => d.count === 0 ? "" : d.count)
            .style("font-size", "14px")
    ;

    // add the dots
    svg.selectAll("dots")
        .data(data)
        .enter()
        .append("circle")
            .attr("cx", d => x_scale(d.x) + x_scale.bandwidth() / 2)
            .attr("cy", d => y_right_scale(d.count))
            .attr("r", data.length < 50 ? 5 : 3)
            .attr("fill", "#191970")
    ;


    // add chart title
    svg.append("text")
        .attr("x", width / 2)             
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")  
        .style("font-weight", "bold")
        .style("font-size", "30px") 
        .text(function() {
            if (graph_type == "day"){
                return "Daily Sale VS Time Graph";
            }
            else if (graph_type == "week"){
                return "Weekly Sale VS Time Graph";
            }
            else {
                return "Monthly Sale VS Time Graph";
            }
        })
    ;

    // add x axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .text("Date Range")
    ;

    return;
}


function fill_cards(div, orders, turnover, gst, revenue){
    for (let i = 0; i < 4; i++){
        let card = document.createElement("div");
        card.classList.add("card");

        // top line, and bottom line
        let top = document.createElement("div");
        top.classList.add("top");

        let bottom = document.createElement("div");
        bottom.classList.add("bottom");

        // link
        div.appendChild(card);
        util.appendListChild(card, [top, bottom]);
    }

    let tops = div.getElementsByClassName("top");
    let bottoms = div.getElementsByClassName("bottom");

    tops[0].textContent = `Total Orders`;
    bottoms[0].textContent = `${orders}`;

    tops[1].textContent = `Turnover`;
    bottoms[1].textContent = `$ ${turnover}`;

    tops[2].textContent = `GST`;
    bottoms[2].textContent = `$ ${gst}`;

    tops[3].textContent = `Estimated Revenue`;
    bottoms[3].textContent = `$ ${revenue}`;

    return;
}


function set_up_input_fields(fields){
    // only need to change the input "to" date, max is today
    let today_date = get_today_date_in_text();

    let input_to = fields.querySelector("input[name=to]");
    input_to.max = today_date;

    let input_from = fields.querySelector("input[name=from]");
    input_from.max = today_date;

    // set default value for two dates
    input_from.value = "2021-04-01";
    input_to.value = today_date;

    // add default radio checked
    let radios = fields.querySelectorAll("input[type=radio]");
    radios[0].checked = true;

    // button onclick
    let btn = fields.getElementsByTagName("button")[0];
    btn.addEventListener("click", function(){
        get_and_show_graphs(fields);
        return;
    });

    return;
}


function get_today_date_in_text(){
    let d = new Date();

    let day = d.getDate();
    let month = (d.getMonth() + 1).toString();
    let year = d.getFullYear();

    if (month.length < 2){
        month = `0${month}`;
    }

    let result = `${year}-${month}-${day}`;
    return result;
}


function ceil_to_scale(value, scale){
    let v = (value + scale - 1) / scale 
    return Math.round(v) * scale
}








