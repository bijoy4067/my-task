export default function App() {
  return (
    <div>
      <section className="_social_login_wrapper _layout_main_wrapper">
        <div className="_shape_one">
          <img
            src="/assets/images/shape1.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape.svg"
            alt=""
            className="_dark_shape"
          />
        </div>

        <div className="_shape_two">
          <img
            src="/assets/images/shape2.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape1.svg"
            alt=""
            className="_dark_shape _dark_shape_opacity"
          />
        </div>

        <div className="_shape_three">
          <img
            src="/assets/images/shape3.svg"
            alt=""
            className="_shape_img"
          />
          <img
            src="/assets/images/dark_shape2.svg"
            alt=""
            className="_dark_shape _dark_shape_opacity"
          />
        </div>

        <div className="_social_login_wrap">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-xl-8 col-lg-8 col-md-12 col-sm-12">
                <div className="_social_login_left">
                  <div className="_social_login_left_image">
                    <img
                      src="/assets/images/login.png"
                      alt="Image"
                      className="_left_img"
                    />
                  </div>
                </div>
              </div>

              <div className="col-xl-4 col-lg-4 col-md-12 col-sm-12">
                <div className="_social_login_content">
                  <div className="_social_login_left_logo _mar_b28">
                    <img
                      src="/assets/images/logo.svg"
                      alt="Logo"
                      className="_left_logo"
                    />
                  </div>

                  <p className="_social_login_content_para _mar_b8">
                    Welcome back
                  </p>

                  <h4 className="_social_login_content_title _titl4 _mar_b50">
                    Login to your account
                  </h4>

                  <button
                    type="button"
                    className="_social_login_content_btn _mar_b40"
                  >
                    <img
                      src="/assets/images/google.svg"
                      alt="Google"
                      className="_google_img"
                    />{" "}
                    <span>Or sign-in with Google</span>
                  </button>

                  <div className="_social_login_content_bottom_txt _mar_b40">
                    <span>Or</span>
                  </div>

                  <form className="_social_login_form">
                    <div className="row">
                      <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                          <label className="_social_login_label _mar_b8">
                            Email
                          </label>
                          <input
                            type="email"
                            className="form-control _social_login_input"
                          />
                        </div>
                      </div>

                      <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                          <label className="_social_login_label _mar_b8">
                            Password
                          </label>
                          <input
                            type="password"
                            className="form-control _social_login_input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="form-check _social_login_form_check">
                          <input
                            className="form-check-input _social_login_form_check_input"
                            type="radio"
                            name="flexRadioDefault"
                            id="flexRadioDefault2"
                            defaultChecked
                          />

                          <label
                            className="form-check-label _social_login_form_check_label"
                            htmlFor="flexRadioDefault2"
                          >
                            Remember me
                          </label>
                        </div>
                      </div>

                      <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="_social_login_form_left">
                          <p className="_social_login_form_left_para">
                            Forgot password?
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                        <div className="_social_login_form_btn _mar_t40 _mar_b60">
                          <button
                            type="button"
                            className="_social_login_form_btn_link _btn1"
                          >
                            Login now
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                      <div className="_social_login_bottom_txt">
                        <p className="_social_login_bottom_txt_para">
                          Don't have an account?{" "}
                          <a href="#0">Create New Account</a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}