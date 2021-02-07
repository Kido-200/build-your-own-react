# build-your-own-react
## npm run dev
按照 https://pomb.us/build-your-own-react/ 一步步做<br />
下面讲一下大体流程<br />
React.createElement({type,props,children:[]})返回element {type:,props:{children:[]}}阶段是无法打断的<br />
workloop检查idleCallback调用performUnitOfWork在这里element生成fiber  所以workloop是可以中断的,也就是fiber的生成阶段 <br />
fiber{dom:,type,alternate,props:{children:[]},parent,child,sibling,effectTag,hooks:{queue:[]}} 注意function component没有dom,react里好像也不叫这个属性名<br />
fiber的alternate也就是dom复用,fc要通过fn(props)获得children以及创建dom时对于Event这个property要单独处理等细节在代码里有注释<br />
dom创建时,因为有dom复用的情况(diff)所以注意删除原来的property以及event取消绑定。
在所有fiber生成完后,nextUnitOfWork===null,就可以commitRoot()了,这时候又变得无法打断 <br />
commitRoot()新的fiber链表头,注意新fiber链表是访问不到旧fiber上要删除的dom的,所以要把effectTag="DELETION"的推入全局deletions:[]来进行单独函数处理，删除他们。删完了然后可以commitWork(fiber),把fiber对应dom挂载到父dom上,注意又是fc,fc没有dom,所以要把他的children挂载到该fiber的最近的有真实dom的父亲身上。 <br />
上面是运行流程，还有hook的setState的触发流程。 <br />
setState(action)就把action推到该hook.queue中(setState是useState要返回的函数,也就是定义在useState内部的,所以闭包可以取到对应hook),并且设置新的wipRoot
```
function useState(initial){
  xxx
  const hook = xxx
  xxxx
  const setState = action =>{
    hook.queue.push(action)
    wipRoot = {
      dom:currentRoot.dom,
      props:currentRoot.props,
      alternate:currentRoot
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }
  xxx
  return [state,setState]
}
```
因为nextUnitOfWork有值了,所以下次idleCallback就会调用performUnitOfWork重新创建fiber链表并最后commit()。<br />
我们可以发现,只要setState整个fiber链表都会被重构,也就是说function component的fn(props)会被重新调用以生成fiber。
那么他内部的useState又会被再次调用,所以我们可以在useState里完成state的更新。
```
function useState(initial){
  xxx
  const actions = oldHook ? oldHook.queue : []
  //是下面先调用了setState导致performUnitOfWork重新生成fiber
  //而fc的fiber是要调用fn(props) 导致内部setState被执行使得这里action(hook)
  //useState ->   整棵树渲染 ->  fn()  ->useState() -> action()
  actions.forEach(action => {
    hook.state = action(hook.state)
  })
  const setState = ()=>{}
  xxx
}
```
可以发现hook的状态更新是在useState()里完成的,function component内部useState()调用的第一次在初始化state,以后执行时执行对应的hook.queue内部的action(state)来更新hook.state
