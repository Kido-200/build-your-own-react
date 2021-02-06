//这种方式渲染,当tree太大的时候会导致页面卡死。
//所以要换个方法,让浏览器有能打断他的能力
function createDom(fiber){
  //创造真实DOM节点
  const dom = fiber.type=== "TEXT_ELEMENT"
        ?document.createTextNode("")
        :document.createElement(fiber.type)

  //properties的操作放在这个函数里了
  updateDom(dom,{},fiber.props)

  return dom
}

//事件props单独处理
const isEvent = key => key.startsWith("on")
const isProperty = key => key!=="children" && !isEvent(key)
const isNew = (prev,next) => key => prev[key] !== next[key]
const isGone = (prev,next) => key => !(key in next)

function updateDom(dom,prevProps,nextProps){
  //移除老的事件监听
  Object.keys(prevProps)
    .filter(isEvent)
    //留下不存在在nextProps的以及已经改变了的事件监听
    //防止留下2个onClick 前面那个onClick没删除
    .filter(
      key => 
        !(key in nextProps) ||
        isNew(prevProps,nextProps)(key)
    )
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(
        eventType,
        prevProps[name]
      )
    })


  //移除不在新props里的properties
  Object.keys(prevProps)
    //把children排除
    .filter(isProperty)
    //把在nextProps的properties排除
    .filter(isGone(prevProps,nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  //增加新的properties

  Object.keys(nextProps)
    .filter(isProperty)
    //排除新老props相同value的properties
    .filter(isNew(prevProps,nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  //添加事件监听
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps,nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType,nextProps[name])
    })
}

//commit渲染 无法被打断了
function commitRoot() {
  //新的fiber链表里是没有要删除的fiber的
  //要手动commit来把该fiber对应dom从视图上删除
  deletions.forEach(commitWork)

  //fiber有child指向第一个儿子
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  //防止一直触发workLoop里的commitRoot
  wipRoot = null
}

//将fiber挂载到他父亲身上,也就是把他commit了
function commitWork(fiber){
  //那个节点没儿子,或者没兄弟
  if(!fiber){
    return
  }

  //挂载到父dom,此时他儿子还没挂载到他身上,没关系,下面commit儿子
  //注意fc没有dom,要找到离他最近的并且有dom的父亲
  // const domParent = fiber.parent.dom
  let domParentFiber = fiber.parent
  while(!domParentFiber.dom){
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if(fiber.effectTag === "PLACEMENT" && fiber.dom != null){
    domParent.appendChild(fiber.dom)
  }else if(fiber.effectTag === "DELETION"){
    //注意fiber如果是fc,dom为空
    // domParent.removeChild(fiber.dom)
    commitDeletion(fiber,domParent)
  }else if(fiber.effectTag === "UPDATE" && fiber.dom != null){
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  }

  //这里实现的fiber遍历和下面精髓while做的事情其实是一样的
  //区别在于下面while要保存nextUnit以实现可中断
  //而这里是直接处理完所有fiber,所以也不用知道next是谁
  //把儿子dom挂载到自身
  commitWork(fiber.child)
  //儿子dom挂完了,说明该fiber结束了,让他兄弟开始commit
  commitWork(fiber.sibling)
}

//fn的dom要递归才能删除完,但注意domParent是不变的
function commitDeletion(fiber,domParent){
  if(fiber.dom){
    domParent.removeChild(fiber.dom)
  }else{
    //儿子又是个fn
    commitDeletion(fiber.child,domParent)
  }
}

function render(element,container){
  //初始化fiber为root
  //这样在空闲时,下面的workLoop就能运行
  wipRoot = {
    dom:container,
    props:{
      //从这里可以发现React.createElement是同步进行无法打断的
      //render这里一定要等待所有elements的生成
      //可以打断的是从element变成Fiber这一阶段
      children:[element]
    },
    alternateRoot:currentRoot
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

/*fiber节点
在element基础上扩充了属性,变成了链表节点
{
  type:
  dom:指向真实dom
  parent
  child
  sibling
  props:{
    children:[]
  }

  alternate:
  effectTag
}

*/
let nextUnitOfWork = null
//保存目前dom视图上的fiber链表的头节点
let currentRoot = null
let wipRoot = null
let deletions = null


//我们可以用requestIdleCallback实现
//但React已经不使用这种方法了,他采用scheduler,但概念来说差不多
//requestIdleCallback会传一个deadline让我们判断还剩下多少时间
//实现的是 在可被打断的情况下构建出fiber链表
function workLoop(deadline){
  let shouldYield = false
  while(nextUnitOfWork && !shouldYield){
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)

    shouldYield = deadline.timeRemaining() < 1
  }

  //当fiber链表构造完成时 commit渲染dom
  if(!nextUnitOfWork && wipRoot){
    commitRoot()
  }
  //死循环 有空就一直在执行
  requestIdleCallback(workLoop)
}

//执行该fiber,生成下一层的fiber(fiber的dom在perform他的时候才生成)
//并返回下一个该执行的fiber
//可以发现fiber的生成是可以打断的
//执行一次perform就生成该fiber的dom
//所以fiber的遍历顺序,也是perform的执行顺序会从爸爸儿子跳到叔叔
//因为爸爸已经perform生成了自己dom了
function performUnitOfWork (fiber) {
  // //执行fiber时创建他的真实dom
  // if(!fiber.dom){
  //   fiber.dom = createDom(fiber)
  // }
  
  // const elements = fiber.props.children
  // //通过elements生成所有下一层的儿子fiber
  // reconcileChildren(fiber,elements)

  //考虑到fc没有dom并且children是通过返回值计算出来的 上述代码修改成
  const isFunctionComponent = fiber.type instanceof Function
  if(isFunctionComponent){
    updateFunctionComponent(fiber)
  }else{
    //上面代码就是处理host节点 原封不动放到这函数里
    updateHostComponent(fiber)
  }

  // 因为我们的fiber链构造是可被打断的,
  // 这样直接挂载到真实dom上用户会看见一会多出东西 点两下停一会又多出东西
  // 显然不能这么写 正是fiber的可打断特性引出了commitRoot这一流程
  // //挂载到父dom上
  // if(fiber.parent){
  //   fiber.parent.dom.appendChild(fiber.dom)
  // }



  //返回下一个要执行的fiber
  //有儿子返回儿子
  if(fiber.child){
    return fiber.child
  }
  //没儿子了,如果有兄弟,返回兄弟,不然返回爸爸的兄弟
  //爸爸的兄弟也没有,返回爸爸爸爸的兄弟
  //这个while很精髓,其实就是找兄弟,要么他的兄弟，要么我的兄弟
  //要么我爸的兄弟... 反正肯定返回一个兄弟
  let nextFiber = fiber
  while(nextFiber){
    if(nextFiber.sibling){
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }

}

let wipFiber = null
let hookIndex = null

function updateFunctionComponent(fiber) {

  //保存当前fiber方便生成hooks链表  fc的fiber是有hooks链表 这里用数组了
  wipFiber = fiber
  //fiber.hooks[index]来找到oldfiber的当前hook
  hookIndex = 0
  wipFiber.hooks = []

  //children要通过运行function获得
  //注意我们渲染的fiber的children是function component的返回值
  // <App>123</App>这个123是不会被渲染出来的,React里就是这样的,除非App return {props.children}
  //{变量}  这个变量会被推到element.children里
  //下面执行函数的时候会调用useState来创建该fiber的hooks链表,上面已经把fiber保存在全局了
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber,children)
}

function useState(inital){
  //可能下标越界也就是undefined
  const oldHook = 
  wipFiber.alternate &&
  wipFiber.alternate.hooks &&
  wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : inital,
    //存放外面调用的setState(action)  更新放在双向链表里实现优先级状态更新与状态更新合并
    //这里没有实现优先级,而且只能传函数的action
    queue:[]
  }

  //oldHook存在则拿他的queue,不然的话说明是刚mount上的,queue=[]=hook.queue
  const actions = oldHook ? oldHook.queue : []
  //是下面先调用了setState导致performUnitOfWork重新生成fiber
  //而fc的fiber是要调用fn(props) 导致内部setState被执行使得这里action(hook)
  //useState ->   整棵树渲染 ->  fn()  ->useState() -> action()
  actions.forEach(action => {
    hook.state = action(hook.state)
  })

  //当外面调用setState,说明要更新整个fiber链了,初始化好全局变量
  const setState = action =>{
    hook.queue.push(action)
    //设置新fiber链表root节点,并把他作为nextUnitOfWork
    //这样就能触发idlerequest的workloop了
    wipRoot = {
      dom:currentRoot.dom,
      props:currentRoot.props,
      alternate:currentRoot
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state,setState]

}

function updateHostComponent(fiber){
  
  if(!fiber.dom){
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber,fiber.props.children)
}


//通过elements生成所有下一层的儿子fiber
//注意对于第二次render,要利用老fiber和新elements做个reconcile来实现dom复用(sameType的话)
function reconcileChildren(wipFiber,elements){

  let index = 0
  //下面要遍历wipFiber的child,当然要取出wipFiber的child对应的oldFiber了
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  //index < elements.length 而oldFiber!=null 说明此次render做了删除节点的操作
  while(index < elements.length || 
        oldFiber != null){
    //element可能超出下标不存在
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && element.type === oldFiber.type
    //相同type可以在原fiber的dom上做update 就剩下了创建dom的时间
    if(sameType){
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        //复用dom
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE"
      }
    }
    //类型不同说明他要新的dom
    if(element && !sameType){
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT"
      }
    }
    //delete type不同老fiber还存在,说明对应dom可以被删除了
    if(oldFiber && !sameType){
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if(oldFiber){
      oldFiber = oldFiber.sibling
    }

    if(index === 0){
      wipFiber.child = newFiber
    }else if(element){
      prevSibling.sibling = newFiber
    }
  
    prevSibling = newFiber
    index++
  }
}



requestIdleCallback(workLoop)


export default{
  render,
  useState
}