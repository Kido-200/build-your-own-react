
/*element
无论是标签element还是textelement我们都希望转换成以下对象
{
  type,
  props:{
    xxx,
    children:[]
  }
}
*/
function createElement(type,props,...children){
  return {
    type,
    props:{
      ...props,
      //child两种可能,一种是React.createElement,返回 object
      //第二种就是string,纯文本
      children: children.map(child => {
        //是reactElement
        if(typeof child === 'object'){
          return child
        }
        //是纯文本创建textElement并返回
        else{
          return createTextElement(child)
        }
      })
    }
  }
}
//当没有children的时候react不会包装原始值或创空数组
//我们是为了代码简单才这么做的
function createTextElement(text){
  return {
    type:"TEXT_ELEMENT",
    props:{
      nodeValue:text,
      children:[]
    }
  }
}

export default {
  createElement
}
