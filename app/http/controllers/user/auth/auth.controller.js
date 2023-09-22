const createHttpError = require("http-errors");
const { UserModel } = require("../../../../models/users");
const { getOtpSchema, chackOtpSchema } = require("../../../validators/user/auth.schema");
const Controller = require("../../controller");
const { ROLES } = require("../../../../utils/constans");
const { RandomNumberGenerator, SignAccessToken, VerifyRefreshToken, SignRefreshToken} = require("../../../../utils/functions");
class UserAuthController extends Controller {
  async getOtp(req, res, next) {
    try {
      await getOtpSchema.validateAsync(req.body);
      const { mobile } = req.body;
      const code = RandomNumberGenerator(); 
      const result = await this.saveUser(mobile, code);
      if (!result) throw createHttpError.Unauthorized("ورود شما انجام نشد");
      return res.status(201).json({
        data: {
          statusCode:200,
          message: "کد اعتبار سنجی با موفقیت برای شما ارسال شد",
          code,
          mobile,
        },
      });
    } catch (error) {
      next(error);
    }
  }
 
  async checkOtp(req, res, next) {
    try {
      await chackOtpSchema.validateAsync(req.body)
      const { mobile, code } = req.body;
      // , { password: 0, refreshToken: 0, accessToken: 0}
      const user = await UserModel.findOne({ mobile })
      if (!user) throw createError.NotFound("کاربر یافت نشد")
      if (user.otp.code != code) throw createError.Unauthorized("کد ارسال شده صحیح نمیباشد");
      const now = (new Date()).getTime();
      if (+user.otp.expiresIn < now) throw createError.Unauthorized("کد شما منقضی شده است");
      const accessToken = await SignAccessToken(user._id)
      const refreshToken = await SignRefreshToken(user._id);
      return res.status(201).json({
        statusCode : 201,
        data: {
          accessToken,
          refreshToken,
          user
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body; 
      const mobile = await VerifyRefreshToken(refreshToken);
      const user = await UserModel.findOne({ mobile })
      const accessToken = await SignAccessToken(user._id);
      const newRefreshToken = await SignRefreshToken(user._id);
      return res.status(200).json({
        StatusCode: 200,
        data: {
          accessToken,
          refreshToken: newRefreshToken,
          user
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async saveUser(mobile, code) {
    const now = new Date().getTime();
    let otp = {
      code,
      expiresIn: now + 120000,
    };
    // check user exist or not
    const result = await this.checkExistUser(mobile);
    if (result) {
      return await this.updateUser(mobile, { otp });
    }
    return !!(await UserModel.create({
      mobile,
      otp,
      Roles: ROLES.USER,
    }));
  }

  async checkExistUser(mobile) {
    const user = await UserModel.findOne({ mobile });
    return !!user;
  }

  async updateUser(mobile, objectData = {}) {
    Object.keys(objectData).forEach((key) => {
      if (["", " ", 0, null, undefined, "0", NaN].includes(objectData[key]))
        delete objectData[key];
    });
    const updateResult = await UserModel.updateOne(
      { mobile },
      { $set: objectData }
    );
    return !!updateResult.modifiedCount;
  }
}

module.exports = {
  UserAuthController: new UserAuthController(),
};
