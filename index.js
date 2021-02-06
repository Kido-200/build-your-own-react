
import Didact from './utils/Diact.js'
import DidactDOM from './utils/DiactDOM.js'

//我们希望babel把React.createElement变成Didact,就加下面的注释
/** @jsx Didact.createElement */
function Counter(props){
  const [state,setState] = DidactDOM.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count:{state}
    </h1>
  )
}

const element = <Counter />
// const element = (
//   <div id="foo">
//     <a>bar</a>
//     <b />
//   </div>
// )


//babel会解析成下面的样子
// const element = Didact.createElement(
//   "div",
//   {
//     id:"foo"
//   },
//   Didact.createElement(
//     "a",
//     null,
//     "bar"
//   ),
//   Didact.createElement(
//     "b"
//   )
// )
// console.log(element);

const container = document.getElementById('root')
DidactDOM.render(element,container)