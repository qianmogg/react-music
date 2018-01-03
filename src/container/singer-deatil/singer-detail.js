/**** React应用依赖组件 ****/
// core
import React, { Component } from 'react'
import { connect } from 'react-redux'
/******* 第三方 组件库 *****/
/**** 本地公用变量 公用函数 **/
/******* 本地 公用组件 *****/
/**** 当前组件的 子组件等 ***/

@connect(
  state => ({ state })
)
class SingerDetail extends Component {
  render() {
    console.log(this.props)
    return (
      <div className="c-singer-detailt">SingerDetail-页面</div>
    )
  }
}

export default SingerDetail
